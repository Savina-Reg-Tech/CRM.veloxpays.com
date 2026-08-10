import { query } from "../../config/db.js";

const run = (client, text, params) =>
  client ? client.query(text, params) : query(text, params);

const User = {

  /** Find a user by email. Pass { includePassword: true } when you need the hash. */
  findByEmail: async (email, { includePassword = false } = {}) => {
    const base =
      "id, name, email, role, is_active, account_status, verification_deadline, created_by, created_at";
    const fields = includePassword ? `${base}, password` : base;

    const { rows } = await query(
      `SELECT ${fields} FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );
    return rows[0] || null;
  },

  /** Find a user by primary key. */
  findById: async (id) => {
    const { rows } = await query(
      `SELECT id, name, email, role, is_active, account_status,
              verification_deadline, archived_at, created_by, created_at
         FROM users WHERE id = $1 LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  /** Create a new user row. Returns the created user (no password). */
  create: async (
    {
      name,
      email,
      password,
      role = "employee",
      createdBy = null,
      isActive = true,
      accountStatus = null,
      verificationDeadline = null,
    },
    { client } = {}
  ) => {
    const { rows } = await run(
      client,
      `INSERT INTO users
         (name, email, password, role, created_by, is_active, account_status, verification_deadline)
       VALUES ($1, $2, $3, $4, $5, $6,
               COALESCE($7::account_status,
                        (CASE WHEN $6 THEN 'active' ELSE 'pending' END)::account_status),
               $8)
       RETURNING id, name, email, role, is_active, account_status, verification_deadline, created_at`,
      [name, email, password, role, createdBy, isActive, accountStatus, verificationDeadline]
    );
    return rows[0];
  },

  /** Set account_status (and keep is_active consistent). Returns updated row. */
  setAccountStatus: async (id, status, { client } = {}) => {
    const isActive = status === "active";
    const { rows } = await run(
      client,
      `UPDATE users
          SET account_status = $2::account_status,
              is_active = $3,
              archived_at = CASE WHEN $2::text = 'expired' THEN NOW() ELSE archived_at END,
              updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, email, role, is_active, account_status`,
      [id, status, isActive]
    );
    return rows[0] || null;
  },

  /** Unverified accounts whose verification window has elapsed (expiry sweep). */
  findExpiryCandidates: async ({ before, withinHours } = {}) => {
    if (withinHours != null) {
      // Accounts expiring within the next `withinHours` (24h warning).
      const { rows } = await query(
        `SELECT id, name, email, role, verification_deadline
           FROM users
          WHERE account_status = 'pending'
            AND archived_at IS NULL
            AND verification_deadline IS NOT NULL
            AND verification_deadline > NOW()
            AND verification_deadline <= NOW() + ($1 || ' hours')::interval`,
        [String(withinHours)]
      );
      return rows;
    }
    // Past-deadline accounts to expire now.
    const { rows } = await query(
      `SELECT id, name, email, role
         FROM users
        WHERE account_status = 'pending'
          AND archived_at IS NULL
          AND verification_deadline IS NOT NULL
          AND verification_deadline <= COALESCE($1::timestamptz, NOW())`,
      [before ?? null]
    );
    return rows;
  },

  /** Set is_active explicitly (used by onboarding approval outcomes). */
  setActive: async (id, isActive, { client } = {}) => {
    const { rows } = await run(
      client,
      `UPDATE users
          SET is_active = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING id, is_active`,
      [id, isActive]
    );
    return rows[0] || null;
  },

  /** Return CRM users, newest first, with pagination. */
  findAllUsers: async ({ limit, offset } = {}) => {
    const { rows } = await query(
      `SELECT id, name, email, role, is_active, created_at
         FROM users
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows;
  },

  countAllUsers: async () => {
    const { rows } = await query(`SELECT COUNT(*)::int AS total FROM users`);
    return rows[0].total;
  },

  /** Cheap aggregate for dashboard cards. */
  getUserStats: async () => {
    const { rows } = await query(
      `SELECT
         COUNT(*)::int                                            AS total,
         COUNT(*) FILTER (WHERE is_active = TRUE)::int            AS active,
         COUNT(*) FILTER (WHERE is_active = FALSE)::int           AS inactive
       FROM users`
    );
    return rows[0];
  },

  /** Active super-admins / admins — recipients for "document uploaded" alerts. */
  findModerators: async ({ client } = {}) => {
    const { rows } = await run(
      client,
      `SELECT id, name, email, role
         FROM users
        WHERE role IN ('super_admin', 'admin') AND is_active = TRUE
          AND archived_at IS NULL`
    );
    return rows;
  },

  /**
   * Users in the verification scope (employee/agent/affiliate) with document
   * aggregates, for the admin review portal. Status derivation + the required-
   * docs gate are computed in the service (they depend on the role→docs config).
   *
   * @param {{ roles?: string[]; search?: string }} [filters]
   */
  findVerificationSubjects: async ({ roles, search } = {}) => {
    const params = [];
    let where = `u.role IN ('employee','agent','affiliate')`;

    if (Array.isArray(roles) && roles.length > 0) {
      params.push(roles);
      where += ` AND u.role = ANY($${params.length}::user_role[])`;
    }
    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      const p = params.length;
      // Match name, email, or exact user id.
      where += ` AND (LOWER(u.name) LIKE $${p} OR LOWER(u.email) LIKE $${p}
                      OR CAST(u.id AS TEXT) = $${params.length + 1})`;
      params.push(search.trim());
    }

    const { rows } = await query(
      `SELECT
         u.id, u.name, u.email, u.role, u.is_active, u.account_status,
         u.verification_deadline, u.created_at,
         COUNT(d.id) FILTER (WHERE d.archived_at IS NULL)                       AS docs_uploaded,
         COUNT(d.id) FILTER (WHERE d.archived_at IS NULL AND r.status='approved')  AS docs_approved,
         COUNT(d.id) FILTER (WHERE d.archived_at IS NULL AND r.status='rejected')  AS docs_rejected,
         COUNT(d.id) FILTER (WHERE d.archived_at IS NULL AND r.status='in_review') AS docs_in_review,
         COUNT(d.id) FILTER (WHERE d.archived_at IS NULL AND r.status='pending')   AS docs_pending
       FROM users u
       LEFT JOIN verification_documents d ON d.user_id = u.id
       LEFT JOIN approval_requests r ON r.id = d.approval_request_id
       WHERE ${where}
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
      params
    );
    return rows;
  },

  /** Set a new (already-hashed) password. Returns { id, name, email, role }. */
  setPassword: async (id, hashedPassword, { client } = {}) => {
    const { rows } = await run(
      client,
      `UPDATE users
          SET password = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, email, role`,
      [id, hashedPassword]
    );
    return rows[0] || null;
  },

  /** Toggle is_active for a user. Returns updated row. */
  toggleActive: async (id) => {
    const { rows } = await query(
      `UPDATE users
          SET is_active = NOT is_active, updated_at = NOW()
        WHERE id = $1
        RETURNING id, is_active`,
      [id]
    );
    return rows[0] || null;
  },
};

export default User;

import { query } from "../../config/db.js";

const ROW_COLS = `
  c.id, c.first_name, c.middle_name, c.last_name, c.dob, c.email, c.phone,
  c.address_line1, c.city, c.country, c.status, c.source, c.source_ref,
  c.created_by, c.created_at, c.modified_at, c.deleted_at
`;

const RETURNING_COLS = `
  id, first_name, middle_name, last_name, dob, email, phone,
  address_line1, city, country, status, source, source_ref,
  created_by, created_at, modified_at, deleted_at
`;

const JOIN_ADDED_BY = `
  LEFT JOIN users u ON u.id = c.created_by
`;

const ADDED_BY_FIELDS = `
  , u.name AS added_by_name, u.email AS added_by_email, u.role AS added_by_role
`;

const SERVICES_JSON = `
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',         cs.id,
          'service_id', cs.service_id,
          'code',       s.code,
          'name',       s.name,
          'vendor',     s.vendor,
          'status',     cs.status,
          'enabled_at', cs.enabled_at,
          'source',     cs.source,
          'notes',      cs.notes,
          'created_at', cs.created_at,
          'modified_at',cs.modified_at
        )
        ORDER BY s.name
      )
      FROM customer_services cs
      JOIN services s ON s.id = cs.service_id
      WHERE cs.customer_id = c.id
    ),
    '[]'::jsonb
  ) AS services
`;

const Customer = {
  create: async ({
    firstName,
    middleName,
    lastName,
    dob,
    email,
    phone,
    addressLine1,
    city,
    country,
    status,
    source,
    sourceRef,
    createdBy,
  }) => {
    const { rows } = await query(
      `INSERT INTO customers (
         first_name, middle_name, last_name, dob, email, phone,
         address_line1, city, country, status, source, source_ref, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING ${RETURNING_COLS.replace(/\s+/g, " ").trim()}`,
      [
        firstName,
        middleName || null,
        lastName,
        dob || null,
        email,
        phone || null,
        addressLine1 || null,
        city || null,
        country || null,
        status,
        source,
        sourceRef || null,
        createdBy,
      ]
    );
    return rows[0];
  },

  findById: async (id) => {
    const { rows } = await query(
      `SELECT ${ROW_COLS}${ADDED_BY_FIELDS}, ${SERVICES_JSON}
         FROM customers c
         ${JOIN_ADDED_BY}
        WHERE c.id = $1 AND c.deleted_at IS NULL
        LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  findAllWithAddedBy: async ({ limit, offset } = {}) => {
    const { rows } = await query(
      `SELECT ${ROW_COLS}${ADDED_BY_FIELDS}, ${SERVICES_JSON}
         FROM customers c
         ${JOIN_ADDED_BY}
        WHERE c.deleted_at IS NULL
        ORDER BY c.created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows;
  },

  findByCreatorWithAddedBy: async (createdByUserId, { limit, offset } = {}) => {
    const { rows } = await query(
      `SELECT ${ROW_COLS}${ADDED_BY_FIELDS}, ${SERVICES_JSON}
         FROM customers c
         ${JOIN_ADDED_BY}
        WHERE c.deleted_at IS NULL AND c.created_by = $1
        ORDER BY c.created_at DESC
        LIMIT $2 OFFSET $3`,
      [createdByUserId, limit, offset]
    );
    return rows;
  },

  countAll: async () => {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS total FROM customers WHERE deleted_at IS NULL`
    );
    return rows[0].total;
  },

  countByCreator: async (createdByUserId) => {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS total
         FROM customers
        WHERE deleted_at IS NULL AND created_by = $1`,
      [createdByUserId]
    );
    return rows[0].total;
  },

  /**
   * Soft-delete: sets deleted_at without removing the row. The list/find
   * queries above already filter on `deleted_at IS NULL`, so the record
   * disappears from the API immediately.
   */
  softDeleteById: async (id) => {
    const { rows } = await query(
      `UPDATE customers
          SET deleted_at = NOW(),
              modified_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, deleted_at`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Lookup-by-email used for the duplicate guard. Case-insensitive and
   * scoped to live (non-soft-deleted) rows. `excludeId` lets the update
   * path ignore the row being edited.
   */
  findActiveByEmail: async (email, { excludeId = null } = {}) => {
    const params = [email];
    let extra = "";
    if (excludeId !== null && excludeId !== undefined) {
      params.push(excludeId);
      extra = "AND id <> $2";
    }
    const { rows } = await query(
      `SELECT id FROM customers
        WHERE LOWER(email) = LOWER($1)
          AND deleted_at IS NULL
          ${extra}
        LIMIT 1`,
      params
    );
    return rows[0] || null;
  },

  updateById: async (id, fields) => {
    const {
      firstName,
      middleName,
      lastName,
      dob,
      email,
      phone,
      addressLine1,
      city,
      country,
      status,
      source,
      sourceRef,
    } = fields;

    const { rows } = await query(
      `UPDATE customers
          SET first_name = $2,
              middle_name = $3,
              last_name = $4,
              dob = $5,
              email = $6,
              phone = $7,
              address_line1 = $8,
              city = $9,
              country = $10,
              status = $11,
              source = $12,
              source_ref = $13,
              modified_at = NOW()
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING ${RETURNING_COLS.replace(/\s+/g, " ").trim()}`,
      [
        id,
        firstName,
        middleName || null,
        lastName,
        dob || null,
        email,
        phone || null,
        addressLine1 || null,
        city || null,
        country || null,
        status,
        source,
        sourceRef || null,
      ]
    );
    return rows[0] || null;
  },
};

export default Customer;

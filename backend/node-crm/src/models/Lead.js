import { query } from "../../config/db.js";

const Lead = {
  /** Create a new lead */
  create: async ({
    formId, formName, email, name, phone,
    submissionData, leadSource, status,
    spamScore, ipAddress, userAgent, timeTakenSeconds,
  }) => {
    const { rows } = await query(
      `INSERT INTO leads
         (form_id, form_name, email, name, phone, submission_data, lead_source,
          status, spam_score, ip_address, user_agent, time_taken_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::lead_status, $9, $10, $11, $12)
       RETURNING *`,
      [
        formId,
        formName ?? null,
        email ?? null,
        name ?? null,
        phone ?? null,
        JSON.stringify(submissionData ?? {}),
        leadSource ?? "Website Form",
        status ?? "NEW",
        spamScore ?? 0,
        ipAddress ?? null,
        userAgent ?? null,
        timeTakenSeconds ?? null,
      ]
    );
    return rows[0];
  },

  /** List leads with pagination and filters */
  list: async ({ limit = 20, offset = 0, formId = null, status = null, search = null } = {}) => {
    const params = [limit, offset];
    const conditions = [];
    let i = 3;

    if (formId) { conditions.push(`l.form_id = $${i++}`); params.push(formId); }
    if (status) { conditions.push(`l.status = $${i++}::lead_status`); params.push(status); }
    if (search && search.trim()) {
      const like = `%${search.trim().toLowerCase()}%`;
      conditions.push(`(LOWER(l.email) LIKE $${i} OR LOWER(l.name) LIKE $${i})`);
      params.push(like);
      i++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await query(
      `SELECT l.*, f.name AS form_name_ref
         FROM leads l
         LEFT JOIN forms f ON f.id = l.form_id
         ${whereClause}
         ORDER BY l.created_at DESC
         LIMIT $1 OFFSET $2`,
      params
    );
    return rows;
  },

  /** Count leads with filters */
  count: async ({ formId = null, status = null, search = null } = {}) => {
    const params = [];
    const conditions = [];
    let i = 1;

    if (formId) { conditions.push(`form_id = $${i++}`); params.push(formId); }
    if (status) { conditions.push(`status = $${i++}::lead_status`); params.push(status); }
    if (search && search.trim()) {
      const like = `%${search.trim().toLowerCase()}%`;
      conditions.push(`(LOWER(email) LIKE $${i} OR LOWER(name) LIKE $${i})`);
      params.push(like);
      i++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await query(
      `SELECT COUNT(*)::int AS total FROM leads ${whereClause}`,
      params
    );
    return rows[0].total;
  },

  /** Find a single lead */
  findById: async (id) => {
    const { rows } = await query(
      `SELECT l.*, f.name AS form_name_ref FROM leads l LEFT JOIN forms f ON f.id = l.form_id WHERE l.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  /** Update lead status */
  updateStatus: async (id, status) => {
    const convertedAt = status === "CONVERTED" ? "NOW()" : "converted_at";
    const { rows } = await query(
      `UPDATE leads
          SET status = $2::lead_status,
              converted_at = ${convertedAt}
        WHERE id = $1
        RETURNING *`,
      [id, status]
    );
    return rows[0] || null;
  },

  /** Stats summary */
  getStats: async () => {
    const { rows } = await query(
      `SELECT
         COUNT(*)::int                                           AS total,
         COUNT(*) FILTER (WHERE status = 'NEW')::int           AS new_leads,
         COUNT(*) FILTER (WHERE status = 'REVIEW')::int        AS review_leads,
         COUNT(*) FILTER (WHERE status = 'SPAM')::int          AS spam_leads,
         COUNT(*) FILTER (WHERE status = 'CONVERTED')::int     AS converted_leads
       FROM leads`
    );
    return rows[0];
  },
};

export default Lead;

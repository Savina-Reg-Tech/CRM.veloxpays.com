import { query } from "../../config/db.js";

const FormSubmission = {
  /** Create a new submission record */
  create: async ({ formId, leadId, submissionData, email, ipAddress, userAgent, timeTakenSeconds, spamScore, status }) => {
    const { rows } = await query(
      `INSERT INTO form_submissions
         (form_id, lead_id, submission_data, email, ip_address, user_agent, time_taken_seconds, spam_score, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::lead_status)
       RETURNING
         id, form_id, lead_id, submission_data, email, ip_address, user_agent,
         time_taken_seconds::float8 AS time_taken_seconds,
         spam_score::int            AS spam_score,
         status, created_at`,
      [
        formId,
        leadId ?? null,
        JSON.stringify(submissionData ?? {}),
        email ?? null,
        ipAddress ?? null,
        userAgent ?? null,
        timeTakenSeconds ?? null,
        spamScore ?? 0,
        status ?? "NEW",
      ]
    );
    return rows[0];
  },

  /** List submissions for a form with pagination */
  listByForm: async (formId, { limit = 20, offset = 0, status = null } = {}) => {
    const params = [formId, limit, offset];
    const statusClause = status ? `AND s.status = $4::lead_status` : "";
    if (status) params.push(status);

    const { rows } = await query(
      `SELECT
         s.id,
         s.form_id,
         s.lead_id,
         s.submission_data,
         s.email,
         s.ip_address,
         s.user_agent,
         s.time_taken_seconds::float8  AS time_taken_seconds,
         s.spam_score::int             AS spam_score,
         s.status,
         s.created_at
       FROM form_submissions s
       WHERE s.form_id = $1 ${statusClause}
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      params
    );
    return rows;
  },

  /** Count submissions for a form */
  countByForm: async (formId, { status = null } = {}) => {
    const params = [formId];
    const statusClause = status ? `AND status = $2::lead_status` : "";
    if (status) params.push(status);

    const { rows } = await query(
      `SELECT COUNT(*)::int AS total FROM form_submissions WHERE form_id = $1 ${statusClause}`,
      params
    );
    return rows[0].total;
  },

  /** Find a single submission by id */
  findById: async (id) => {
    const { rows } = await query(
      `SELECT
         id, form_id, lead_id, submission_data, email, ip_address, user_agent,
         time_taken_seconds::float8 AS time_taken_seconds,
         spam_score::int            AS spam_score,
         status, created_at
       FROM form_submissions WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  /** Per-form analytics: daily submission counts over last 30 days */
  getDailyStats: async (formId) => {
    const { rows } = await query(
      `SELECT
         TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS day,
         COUNT(*)::int                           AS count
       FROM form_submissions
       WHERE form_id = $1
         AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY DATE(created_at)`,
      [formId]
    );
    // Ensure count is always a JS number
    return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
  },

  /** Fetch ALL submissions for a form (no pagination — used for CSV export) */
  exportByForm: async (formId, { status = null } = {}) => {
    const params = [formId];
    const statusClause = status ? `AND status = $2::lead_status` : "";
    if (status) params.push(status);
    const { rows } = await query(
      `SELECT
         id, email, status,
         spam_score::int            AS spam_score,
         time_taken_seconds::float8 AS time_taken_seconds,
         ip_address, submission_data, created_at
       FROM form_submissions
       WHERE form_id = $1 ${statusClause}
       ORDER BY created_at DESC`,
      params
    );
    return rows;
  },

  /** Global analytics */
  getGlobalStats: async () => {
    const { rows } = await query(
      `SELECT
         COUNT(*)::int                                              AS total,
         COUNT(*) FILTER (WHERE status = 'NEW')::int              AS normal,
         COUNT(*) FILTER (WHERE status = 'REVIEW')::int           AS review,
         COUNT(*) FILTER (WHERE status = 'SPAM')::int             AS spam,
         COUNT(*) FILTER (WHERE status = 'CONVERTED')::int        AS converted
       FROM form_submissions`
    );
    // Coerce all values to numbers
    const row = rows[0];
    return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)]));
  },
};

export default FormSubmission;

import { query } from "../../config/db.js";

const Form = {
  /** Create a new form */
  create: async ({ name, slug, description, formJson, submitButtonLabel, successMessage, status, createdBy, notifyOnSubmission, notifyEmails, autoRespond, autoRespondSubject, autoRespondBody }) => {
    const { rows } = await query(
      `INSERT INTO forms (name, slug, description, form_json, submit_button_label, success_message, status, created_by,
                          notify_on_submission, notify_emails, auto_respond, auto_respond_subject, auto_respond_body)
       VALUES ($1, $2, $3, $4, $5, $6, $7::form_status, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        name,
        slug,
        description ?? null,
        JSON.stringify(formJson ?? { fields: [] }),
        submitButtonLabel ?? "Submit",
        successMessage ?? "Thank you! Your submission has been received.",
        status ?? "draft",
        createdBy ?? null,
        notifyOnSubmission ?? false,
        notifyEmails ?? [],
        autoRespond ?? false,
        autoRespondSubject ?? "Thanks for reaching out!",
        autoRespondBody ?? "Hi {{name}},\n\nThank you for your submission. We will get back to you shortly.\n\nBest regards,\nThe Team",
      ]
    );
    return rows[0];
  },

  /** Find form by primary key */
  findById: async (id) => {
    const { rows } = await query(`SELECT * FROM forms WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  /** Find form by slug (used in public routes) */
  findBySlug: async (slug) => {
    const { rows } = await query(`SELECT * FROM forms WHERE slug = $1`, [slug]);
    return rows[0] || null;
  },

  /** Check if slug already exists (for uniqueness) */
  slugExists: async (slug, excludeId = null) => {
    const { rows } = await query(
      `SELECT id FROM forms WHERE slug = $1 ${excludeId ? "AND id != $2" : ""}`,
      excludeId ? [slug, excludeId] : [slug]
    );
    return rows.length > 0;
  },

  /** List all forms with pagination */
  list: async ({ limit = 20, offset = 0, status = null } = {}) => {
    const params = [limit, offset];
    const whereClause = status ? `WHERE f.status = $3::form_status` : "";
    if (status) params.push(status);

    const { rows } = await query(
      `SELECT f.*, u.name AS created_by_name, u.email AS created_by_email
         FROM forms f
         LEFT JOIN users u ON u.id = f.created_by
         ${whereClause}
         ORDER BY f.created_at DESC
         LIMIT $1 OFFSET $2`,
      params
    );
    return rows;
  },

  /** Count total forms */
  count: async ({ status = null } = {}) => {
    const params = [];
    const whereClause = status ? `WHERE status = $1::form_status` : "";
    if (status) params.push(status);

    const { rows } = await query(
      `SELECT COUNT(*)::int AS total FROM forms ${whereClause}`,
      params
    );
    return rows[0].total;
  },

  /** Update a form */
  update: async (id, { name, description, formJson, submitButtonLabel, successMessage, status, slug, notifyOnSubmission, notifyEmails, autoRespond, autoRespondSubject, autoRespondBody }) => {
    const fields = [];
    const params = [];
    let i = 1;

    if (name       !== undefined) { fields.push(`name = $${i++}`);                params.push(name); }
    if (slug       !== undefined) { fields.push(`slug = $${i++}`);                params.push(slug); }
    if (description !== undefined){ fields.push(`description = $${i++}`);         params.push(description); }
    if (formJson   !== undefined) { fields.push(`form_json = $${i++}`);           params.push(JSON.stringify(formJson)); }
    if (submitButtonLabel !== undefined) { fields.push(`submit_button_label = $${i++}`); params.push(submitButtonLabel); }
    if (successMessage !== undefined)    { fields.push(`success_message = $${i++}`);     params.push(successMessage); }
    if (status     !== undefined) { fields.push(`status = $${i++}::form_status`); params.push(status); }
    if (notifyOnSubmission !== undefined) { fields.push(`notify_on_submission = $${i++}`); params.push(notifyOnSubmission); }
    if (notifyEmails !== undefined)       { fields.push(`notify_emails = $${i++}`);        params.push(notifyEmails); }
    if (autoRespond !== undefined)        { fields.push(`auto_respond = $${i++}`);         params.push(autoRespond); }
    if (autoRespondSubject !== undefined) { fields.push(`auto_respond_subject = $${i++}`); params.push(autoRespondSubject); }
    if (autoRespondBody !== undefined)    { fields.push(`auto_respond_body = $${i++}`);    params.push(autoRespondBody); }

    if (fields.length === 0) return Form.findById(id);

    params.push(id);
    const { rows } = await query(
      `UPDATE forms SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    return rows[0] || null;
  },

  /** Increment submission / lead counters atomically */
  incrementCounters: async (id, { submissions = 0, leads = 0 } = {}) => {
    await query(
      `UPDATE forms
          SET total_submissions = total_submissions + $2,
              total_leads       = total_leads       + $3
        WHERE id = $1`,
      [id, submissions, leads]
    );
  },

  /** Soft-delete by setting status to archived */
  archive: async (id) => {
    const { rows } = await query(
      `UPDATE forms SET status = 'archived' WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0] || null;
  },

  /** Hard delete */
  delete: async (id) => {
    await query(`DELETE FROM forms WHERE id = $1`, [id]);
  },

  /** Analytics summary */
  getStats: async () => {
    const { rows } = await query(
      `SELECT
         COUNT(*)::int                                              AS total_forms,
         COUNT(*) FILTER (WHERE status = 'published')::int        AS published_forms,
         COALESCE(SUM(total_submissions),0)::int                   AS total_submissions,
         COALESCE(SUM(total_leads),0)::int                         AS total_leads
       FROM forms`
    );
    return rows[0];
  },
};

export default Form;

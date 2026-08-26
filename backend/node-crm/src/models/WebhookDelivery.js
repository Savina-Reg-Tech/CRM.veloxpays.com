import { query } from "../../config/db.js";

const WebhookDelivery = {
  /** Record the outcome of one webhook send attempt (admin-visible log). */
  create: async ({ formId, submissionId, ruleId, ruleName, url, success, statusCode, errorMessage, durationMs }) => {
    const { rows } = await query(
      `INSERT INTO webhook_deliveries
         (form_id, submission_id, rule_id, rule_name, url, success, status_code, error_message, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        formId,
        submissionId ?? null,
        ruleId ?? null,
        ruleName ?? null,
        url,
        success ?? false,
        statusCode ?? null,
        errorMessage ?? null,
        durationMs ?? null,
      ]
    );
    return rows[0];
  },

  /** List recent deliveries for a form (most recent first). */
  listByForm: async (formId, { limit = 20, offset = 0 } = {}) => {
    const { rows } = await query(
      `SELECT * FROM webhook_deliveries
       WHERE form_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [formId, limit, offset]
    );
    return rows;
  },

  /** Count deliveries for a form. */
  countByForm: async (formId) => {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS total FROM webhook_deliveries WHERE form_id = $1`,
      [formId]
    );
    return rows[0].total;
  },
};

export default WebhookDelivery;

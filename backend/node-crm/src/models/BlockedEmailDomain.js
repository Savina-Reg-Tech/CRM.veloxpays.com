import { query } from "../../config/db.js";

const BlockedEmailDomain = {
  /** Check if a domain is blocked */
  isBlocked: async (domain) => {
    const { rows } = await query(
      `SELECT id FROM blocked_email_domains WHERE LOWER(domain) = LOWER($1)`,
      [domain]
    );
    return rows.length > 0;
  },

  /** List all blocked domains */
  list: async ({ limit = 100, offset = 0 } = {}) => {
    const { rows } = await query(
      `SELECT * FROM blocked_email_domains ORDER BY domain ASC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows;
  },

  /** Count blocked domains */
  count: async () => {
    const { rows } = await query(`SELECT COUNT(*)::int AS total FROM blocked_email_domains`);
    return rows[0].total;
  },

  /** Add a domain to the block list */
  create: async (domain) => {
    const { rows } = await query(
      `INSERT INTO blocked_email_domains (domain) VALUES (LOWER($1))
       ON CONFLICT (domain) DO NOTHING
       RETURNING *`,
      [domain]
    );
    return rows[0] || null;
  },

  /** Remove a domain from the block list */
  delete: async (id) => {
    const { rows } = await query(
      `DELETE FROM blocked_email_domains WHERE id = $1 RETURNING *`,
      [id]
    );
    return rows[0] || null;
  },
};

export default BlockedEmailDomain;

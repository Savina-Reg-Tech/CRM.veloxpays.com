import { query } from "../../config/db.js";

const run = (client, text, params) =>
  client ? client.query(text, params) : query(text, params);

const Notification = {
  insert: async (client, { userId, event, title, body, metadata }) => {
    const { rows } = await run(
      client,
      `INSERT INTO notifications (user_id, event, title, body, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING id, user_id, event, title, body, metadata, read_at, created_at`,
      [userId, event, title, body ?? null, metadata ? JSON.stringify(metadata) : null]
    );
    return rows[0];
  },

  listForUser: async (userId, { limit = 20, offset = 0 } = {}) => {
    const { rows } = await query(
      `SELECT id, user_id, event, title, body, metadata, read_at, created_at
         FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return rows;
  },

  unreadCount: async (userId) => {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS count
         FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
    return rows[0].count;
  },

  markRead: async (userId, id) => {
    const { rows } = await query(
      `UPDATE notifications SET read_at = NOW()
        WHERE id = $1 AND user_id = $2 AND read_at IS NULL
        RETURNING id, read_at`,
      [id, userId]
    );
    return rows[0] || null;
  },

  markAllRead: async (userId) => {
    const { rows } = await query(
      `UPDATE notifications SET read_at = NOW()
        WHERE user_id = $1 AND read_at IS NULL
        RETURNING id`,
      [userId]
    );
    return rows.length;
  },
};

export default Notification;

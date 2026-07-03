import { query } from "../../config/db.js";

const COLS = `id, code, name, description, vendor, is_enabled, created_at`;

const Service = {
  findAll: async ({ includeDisabled = false } = {}) => {
    const where = includeDisabled ? "" : "WHERE is_enabled = TRUE";
    const { rows } = await query(
      `SELECT ${COLS}
         FROM services
         ${where}
         ORDER BY name ASC`
    );
    return rows;
  },

  findByCode: async (code) => {
    const { rows } = await query(
      `SELECT ${COLS} FROM services WHERE code = $1 LIMIT 1`,
      [code]
    );
    return rows[0] || null;
  },

  findByCodes: async (codes) => {
    if (!Array.isArray(codes) || codes.length === 0) return [];
    const { rows } = await query(
      `SELECT ${COLS} FROM services WHERE code = ANY($1::text[])`,
      [codes]
    );
    return rows;
  },
};

export default Service;

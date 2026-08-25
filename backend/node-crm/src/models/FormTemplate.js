import { query } from "../../config/db.js";

const FormTemplate = {
  /** Create a new theme template */
  create: async ({ name, description, theme, createdBy }) => {
    const { rows } = await query(
      `INSERT INTO form_templates (name, description, theme, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description ?? null, JSON.stringify(theme), createdBy ?? null]
    );
    return rows[0];
  },

  /** Find by primary key */
  findById: async (id) => {
    const { rows } = await query(`SELECT * FROM form_templates WHERE id = $1`, [id]);
    return rows[0] || null;
  },

  /** List all templates — global, shared across all developers (see
   * formTemplateService.js for the reasoning). */
  list: async () => {
    const { rows } = await query(
      `SELECT t.*, u.name AS created_by_name
         FROM form_templates t
         LEFT JOIN users u ON u.id = t.created_by
        ORDER BY t.name ASC`
    );
    return rows;
  },

  /** Update a template's fields */
  update: async (id, { name, description, theme }) => {
    const fields = [];
    const params = [];
    let i = 1;

    if (name !== undefined) { fields.push(`name = $${i++}`); params.push(name); }
    if (description !== undefined) { fields.push(`description = $${i++}`); params.push(description); }
    if (theme !== undefined) { fields.push(`theme = $${i++}`); params.push(JSON.stringify(theme)); }

    if (fields.length === 0) return FormTemplate.findById(id);

    params.push(id);
    const { rows } = await query(
      `UPDATE form_templates SET ${fields.join(", ")} WHERE id = $${i} RETURNING *`,
      params
    );
    return rows[0] || null;
  },

  /** Hard delete */
  delete: async (id) => {
    await query(`DELETE FROM form_templates WHERE id = $1`, [id]);
  },
};

export default FormTemplate;

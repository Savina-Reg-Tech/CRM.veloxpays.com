import { query, getClient } from "../../config/db.js";

const SELECT_WITH_CATALOG = `
  SELECT
    cs.id, cs.customer_id, cs.service_id, cs.status, cs.enabled_at,
    cs.source, cs.notes, cs.created_at, cs.modified_at,
    s.code AS service_code, s.name AS service_name, s.vendor AS service_vendor
  FROM customer_services cs
  JOIN services s ON s.id = cs.service_id
`;

const CustomerService = {
  findByCustomerId: async (customerId) => {
    const { rows } = await query(
      `${SELECT_WITH_CATALOG}
       WHERE cs.customer_id = $1
       ORDER BY s.name ASC`,
      [customerId]
    );
    return rows;
  },

  /**
   * Replace the full set of services for a customer atomically.
   * `items`: [{ service_id, status, source, notes }]
   */
  syncForCustomer: async (customerId, items) => {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const wantedIds = items.map((i) => i.service_id);
      if (wantedIds.length === 0) {
        await client.query(
          `DELETE FROM customer_services WHERE customer_id = $1`,
          [customerId]
        );
      } else {
        await client.query(
          `DELETE FROM customer_services
             WHERE customer_id = $1
               AND service_id <> ALL($2::int[])`,
          [customerId, wantedIds]
        );
      }

      for (const item of items) {
        await client.query(
          `INSERT INTO customer_services
             (customer_id, service_id, status, source, notes)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (customer_id, service_id)
           DO UPDATE SET
             status      = EXCLUDED.status,
             source      = EXCLUDED.source,
             notes       = EXCLUDED.notes,
             modified_at = NOW()`,
          [
            customerId,
            item.service_id,
            item.status,
            item.source,
            item.notes,
          ]
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
};

export default CustomerService;

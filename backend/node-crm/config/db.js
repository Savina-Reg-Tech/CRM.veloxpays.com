import pg from "pg";

const { Pool } = pg;

// PostgreSQL connection pool
const pool = new Pool({
  host:     process.env.DB_HOST     || "localhost",
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || "crm_db",
  user:     process.env.DB_USER     || "postgres",
  password: process.env.DB_PASSWORD || "",
  // Keep up to 10 idle connections in the pool
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on("connect", () => {
  console.log("✅ PostgreSQL connected");
});

pool.on("error", (err) => {
  console.error("❌ Unexpected PostgreSQL error:", err.message);
  process.exit(1);
}); 

/**
 * Usage: query("SELECT * FROM users WHERE id = $1", [userId])
 */
export const query = (text, params) => pool.query(text, params);

/**
 * Remember to call client.release() when done.
 */
export const getClient = () => pool.connect();

export default pool;

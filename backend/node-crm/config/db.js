import pg from "pg";

const { Pool } = pg;

// PostgreSQL connection pool
const pool = new Pool({
  host:     process.env.DB_HOST     || "localhost",
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || "crm_db",
  user:     process.env.DB_USER     || "postgres",
  password: process.env.DB_PASSWORD || "",
  // SSL is required by Lightsail managed Postgres. Do NOT remove this line.
  // For a local Postgres without SSL, set DB_SSL=false in your local .env instead.
  ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
  // Keep up to 10 idle connections in the pool
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

console.log(`🔐 PostgreSQL SSL: ${process.env.DB_SSL === "false" ? "OFF" : "ON"}`);

// Test connection on startup
pool.on("connect", () => {
  console.log("✅ PostgreSQL connected");
});

// An idle client died (e.g. a managed-Postgres failover). The pool has already discarded it and
// opens a fresh connection on the next query, so log and keep serving — exiting here turned
// every failover into a crash loop.
pool.on("error", (err) => {
  console.error("❌ Unexpected PostgreSQL error on an idle client:", err.message);
});

/**
 * Usage: query("SELECT * FROM users WHERE id = $1", [userId])
 */
/**
 * Postgres errors that mean "the request was bad", not "the server broke". Controllers answer
 * with `err.status || 500` and `err.message`, so giving these a status and a plain message turns
 * e.g. GET /customers/abc into a 400 instead of a 500 quoting Postgres. `err.code` is kept, so
 * services that map 23505 to their own message still can.
 */
const CLIENT_ERRORS = {
  "22P02": [400, "Invalid input"],            // invalid_text_representation ('abc' for an integer id)
  "22003": [400, "A number is out of range"], // numeric_value_out_of_range
  "22007": [400, "Invalid date"],             // invalid_datetime_format
  "22008": [400, "Invalid date"],             // datetime_field_overflow
  "23505": [409, "This record already exists"], // unique_violation
};

const withHttpStatus = (err) => {
  const mapped = err?.status === undefined && CLIENT_ERRORS[err?.code];
  if (mapped) {
    err.dbMessage = err.message;
    [err.status, err.message] = mapped;
  }
  return err;
};

export const query = (text, params) =>
  pool.query(text, params).catch((err) => {
    throw withHttpStatus(err);
  });

/**
 * Remember to call client.release() when done.
 */
export const getClient = () => pool.connect();

export default pool;

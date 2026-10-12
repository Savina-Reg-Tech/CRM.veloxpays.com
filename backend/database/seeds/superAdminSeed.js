/**
 * Creates the super-admin account.
 *
 *   SUPER_ADMIN_PASSWORD='…' node database/seeds/superAdminSeed.js
 *
 * The password is never stored in the repo: it comes from SUPER_ADMIN_PASSWORD and is never
 * printed. If the account already exists nothing is changed, unless
 * SUPER_ADMIN_RESET_PASSWORD=true is set — a deliberate, explicit password reset.
 */

import "dotenv/config";
import bcrypt from "bcrypt";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.DB_HOST     || "localhost",
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || "crm_db",
  user:     process.env.DB_USER     || "postgres",
  password: process.env.DB_PASSWORD || "",
});

// Must stay the protected account — see PROTECTED_SUPER_ADMIN_EMAIL in node-crm/src/config/crmRoles.js.
const SUPER_ADMIN = {
  name:  "Super Admin",
  email: "admin@crm.com",
  role:  "super_admin",
};

/** Same rules as node-crm/src/utils/passwordPolicy.js (kept inline: this script runs from two layouts). */
const passwordProblem = (password) => {
  if (typeof password !== "string" || password === "") {
    return "SUPER_ADMIN_PASSWORD is not set.";
  }
  if (password !== password.trim()) return "SUPER_ADMIN_PASSWORD must not start or end with spaces.";
  if (password.length < 10 || password.length > 128) return "SUPER_ADMIN_PASSWORD must be 10–128 characters.";
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return "SUPER_ADMIN_PASSWORD must include uppercase, lowercase, a number and a special character.";
  }
  return null;
};

const seed = async () => {
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const resetExisting = String(process.env.SUPER_ADMIN_RESET_PASSWORD || "").toLowerCase() === "true";
  const emailNorm = SUPER_ADMIN.email.trim().toLowerCase();

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT id FROM users WHERE LOWER(TRIM(email)) = $1 LIMIT 1",
      [emailNorm]
    );

    if (rows.length > 0 && !resetExisting) {
      console.log(`✅ Super Admin (${emailNorm}) already exists — left unchanged.`);
      console.log("   To reset its password on purpose, re-run with SUPER_ADMIN_RESET_PASSWORD=true.\n");
      return;
    }

    const problem = passwordProblem(password);
    if (problem) {
      console.error(`❌ ${problem}`);
      console.error("   Choose a strong password and pass it in the environment, e.g.");
      console.error("     SUPER_ADMIN_PASSWORD='…' docker compose run --rm seed\n");
      process.exitCode = 1;
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (rows.length > 0) {
      await client.query(
        `UPDATE users
            SET name = $1,
                email = $2,
                password = $3,
                role = $4,
                is_active = true
          WHERE id = $5`,
        [SUPER_ADMIN.name, emailNorm, hashedPassword, SUPER_ADMIN.role, rows[0].id]
      );
      console.log(`🔐 Super Admin (${emailNorm}) password reset to SUPER_ADMIN_PASSWORD.\n`);
      return;
    }

    await client.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)`,
      [SUPER_ADMIN.name, emailNorm, hashedPassword, SUPER_ADMIN.role]
    );

    console.log(`🎉 Super Admin created: ${emailNorm} (password = SUPER_ADMIN_PASSWORD).\n`);
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

seed();

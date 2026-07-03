/**
 *
 *   node database/seeds/superAdminSeed.js
 *
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

const SUPER_ADMIN = {
  name:     "Super Admin",
  email:    "admin@crm.com",
  // Meets app password policy (length + upper/lower/digit/special)
  password: "VeloxAdmin@2026!",
  role:     "super_admin",
};

const seed = async () => {
  const client = await pool.connect();
  try {
    const emailNorm = SUPER_ADMIN.email.trim().toLowerCase();
    const hashedPassword = await bcrypt.hash(SUPER_ADMIN.password, 10);

    const { rows } = await client.query(
      "SELECT id FROM users WHERE LOWER(TRIM(email)) = $1 LIMIT 1",
      [emailNorm]
    );

    if (rows.length > 0) {
      await client.query(
        `UPDATE users
            SET name = $1,
                email = $2,
                password = $3,
                role = $4,
                is_active = true
          WHERE id = $5`,
        [
          SUPER_ADMIN.name,
          emailNorm,
          hashedPassword,
          SUPER_ADMIN.role,
          rows[0].id,
        ]
      );
      console.log("🔐 Super Admin already existed — password reset and account synced.");
      console.log(`   Email   : ${emailNorm}`);
      console.log(`   Password: ${SUPER_ADMIN.password}`);
      console.log("   ⚠️  Change the password after first login!\n");
      return;
    }

    await client.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)`,
      [SUPER_ADMIN.name, emailNorm, hashedPassword, SUPER_ADMIN.role]
    );

    console.log("🎉 Super Admin seeded successfully!");
    console.log(`   Email   : ${emailNorm}`);
    console.log(`   Password: ${SUPER_ADMIN.password}`);
    console.log("   ⚠️  Change the password after first login!\n");
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

seed();

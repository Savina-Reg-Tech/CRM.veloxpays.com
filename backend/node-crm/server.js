import "dotenv/config";
import app from "./src/app.js";
import pool from "./config/db.js";
import { startExpiryScheduler } from "./src/jobs/expiryWorker.js";
import { assertSafeEnv } from "./src/config/validateEnv.js";
import { storageStatus } from "./src/storage/index.js";
import { isMailConfigured, mailTransportKind } from "./src/utils/mailer.js";

assertSafeEnv();

// Express 4 ignores the promise an async handler returns, so a rejection that escapes a handler's
// try/catch lands here. Node's default for these is to exit, which would drop every in-flight
// request for one bad download. Log it and keep serving; uncaught *exceptions* still exit.
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled promise rejection:", reason);
});

const PORT = process.env.PORT || 5002;

// Verify DB is reachable, then start the HTTP server
pool.connect()
  .then((client) => {
    client.release();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`   Environment : ${process.env.NODE_ENV || "development"}`);
      console.log(`   Database    : ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
    });
    // Daily verification-expiry sweep (in-process scheduler).
    startExpiryScheduler();
    if (isMailConfigured()) console.log(`📧 Email      : ${mailTransportKind()}`);
    else if (process.env.NODE_ENV === "production")
      console.error("❌ Email is NOT configured (set SMTP_HOST, or MAIL_USER + MAIL_APP_PASSWORD): password reset is disabled and no notifications are sent");
    // Say plainly whether uploaded documents have somewhere safe to live. Never blocks startup.
    storageStatus().then((s) => {
      if (!s.ok) console.error(`❌ Document storage is NOT working (${s.kind}): ${s.error}`);
      else if (s.kind === "s3") console.log(`✅ Document storage: S3 bucket "${s.bucket}" (${s.region}) is reachable`);
      if (s.warning) console.warn(`⚠️  ${s.warning}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect to PostgreSQL:", err.message);
    process.exit(1);
  });

/**
 * One-shot CLI entry for the verification-expiry sweep.
 * Use as an external/cron-driven alternative to the in-process scheduler:
 *   node src/jobs/runExpiry.js
 *   docker compose run --rm expire
 */
import "dotenv/config";
import pool from "../../config/db.js";
import { runDailyExpiry } from "./expiryWorker.js";

runDailyExpiry()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Expiry run failed:", err);
    process.exit(1);
  });

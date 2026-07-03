/**
 * Daily verification-expiry sweep.
 *
 * Per product decision we do NOT hard-delete. Accounts that miss the 7-day
 * verification window move to account_status='expired' (is_active=false, which
 * blocks login), and their documents are SOFT-DELETED (archived_at set; rows and
 * audit history are preserved). Object bytes may optionally be purged from
 * storage while metadata is retained for compliance.
 *
 * Two passes run each day:
 *   1. 24-hour warning — notify accounts expiring within the next day.
 *   2. Expire — process accounts whose deadline has passed.
 */
import cron from "node-cron";
import User from "../models/User.js";
import ApprovalRequest from "../models/ApprovalRequest.js";
import VerificationDocument from "../models/VerificationDocument.js";
import { getClient } from "../../config/db.js";
import { storage } from "../storage/index.js";
import { notify } from "../services/notificationService.js";

const PURGE_FILES = process.env.EXPIRY_PURGE_FILES === "true";

/** Send the "expiring in 24 hours" warning. */
export const runExpiryWarnings = async () => {
  const soon = await User.findExpiryCandidates({ withinHours: 24 });
  for (const u of soon) {
    await notify({
      recipient: u,
      event: "account_expiring_24h",
      title: "Your account expires in 24 hours",
      body: "Complete your document verification within 24 hours to keep your account active.",
      metadata: { verification_deadline: u.verification_deadline },
    });
  }
  return soon.length;
};

/** Expire + soft-delete all accounts past their verification deadline. */
export const runExpirySweep = async () => {
  const expired = await User.findExpiryCandidates();
  let processed = 0;

  for (const u of expired) {
    const client = await getClient();
    let archivedPaths = [];
    try {
      await client.query("BEGIN");

      // Expire the account (sets is_active=false + archived_at via setAccountStatus).
      await User.setAccountStatus(u.id, "expired", { client });

      // Soft-delete the documents (rows kept for audit).
      const archived = await VerificationDocument.archiveAllForUser(u.id, { client });
      archivedPaths = archived.map((d) => d.storage_path);

      // Close the open onboarding request as cancelled with an audit action.
      const onboarding = await ApprovalRequest.findOpenOnboardingByUser(u.id, {
        client,
        forUpdate: true,
      });
      if (onboarding) {
        await ApprovalRequest.updateStatus(client, onboarding.id, {
          status: "cancelled",
          decidedById: null,
          decisionNote: "Account expired — verification window elapsed",
          completedAt: null,
        });
        await ApprovalRequest.insertAction(client, {
          requestId: onboarding.id,
          actorId: u.id, // system action attributed to the subject
          fromStatus: onboarding.status,
          toStatus: "cancelled",
          note: "Auto-expired after 7-day verification window",
          metadata: { event: "account_expired", automated: true },
          actorRole: "system",
        });
      }

      await client.query("COMMIT");
      processed += 1;
    } catch (err) {
      await client.query("ROLLBACK");
      // eslint-disable-next-line no-console
      console.error(`Expiry sweep failed for user ${u.id}:`, err.message);
      client.release();
      continue;
    }
    client.release();

    // Optional best-effort byte purge AFTER metadata is safely archived.
    if (PURGE_FILES) {
      await Promise.all(archivedPaths.map((p) => storage.remove(p).catch(() => {})));
    }

    await notify({
      recipient: u,
      event: "account_expired",
      title: "Your account has expired",
      body: "Verification was not completed within 7 days, so your account has been deactivated. Contact an administrator to restore access.",
      metadata: {},
    });
  }

  return processed;
};

/** Run both passes once (used by the scheduler and the one-shot CLI script). */
export const runDailyExpiry = async () => {
  const warned = await runExpiryWarnings();
  const expired = await runExpirySweep();
  // eslint-disable-next-line no-console
  console.log(`⏰ Expiry sweep: ${warned} warned, ${expired} expired`);
  return { warned, expired };
};

/**
 * Schedule the daily sweep (default 02:00 server time). Disable with
 * EXPIRY_CRON_DISABLED=true (e.g. when running it as an external one-shot job).
 */
export const startExpiryScheduler = () => {
  if (process.env.EXPIRY_CRON_DISABLED === "true") {
    // eslint-disable-next-line no-console
    console.log("⏰ Expiry scheduler disabled (EXPIRY_CRON_DISABLED=true)");
    return null;
  }
  const schedule = process.env.EXPIRY_CRON_SCHEDULE || "0 2 * * *";
  const task = cron.schedule(schedule, () => {
    runDailyExpiry().catch((err) =>
      // eslint-disable-next-line no-console
      console.error("Expiry sweep error:", err.message)
    );
  });
  // eslint-disable-next-line no-console
  console.log(`⏰ Expiry scheduler started (cron: "${schedule}")`);
  return task;
};

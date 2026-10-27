/**
 * "VeloxVerse is down" alerts.
 *
 * Every few minutes the CRM calls VeloxVerse's public health check (GET {VELOXVERSE_API_URL}/health,
 * no login, 200 when up and 503 when its database is down). After several failures in a row it
 * alerts every active admin / super admin (in-app + email) and any extra addresses in
 * VELOXVERSE_ALERT_EMAILS — once per outage — and again when VeloxVerse is back, with how long
 * it was down. A single blip never alerts.
 *
 * State lives in memory: a restart forgets an ongoing outage and alerts again if it continues.
 * Each running CRM instance checks on its own.
 */
import axios from "axios";
import cron from "node-cron";
import User from "../models/User.js";
import { notify } from "../services/notificationService.js";
import { sendMail } from "../utils/mailer.js";

const CHECK_TIMEOUT_MS = 5000;

const healthUrl = () =>
  `${(process.env.VELOXVERSE_API_URL || "http://localhost:5005/api/v1").replace(/\/+$/, "")}/health`;

/**
 * One health check. Up only on HTTP 200. Never throws; only the status code or a short network
 * error code is kept (never a response body, which could carry internal details).
 *
 * @returns {Promise<{ up: boolean; status: number | null; error: string | null; ms: number }>}
 */
export async function checkVeloxVerse({ get = axios.get, url = healthUrl() } = {}) {
  const started = Date.now();
  try {
    const res = await get(url, { timeout: CHECK_TIMEOUT_MS, validateStatus: () => true });
    const up = res.status === 200;
    return { up, status: res.status, error: up ? null : `HTTP ${res.status}`, ms: Date.now() - started };
  } catch (err) {
    const error = err?.code === "ECONNABORTED" ? `no answer within ${CHECK_TIMEOUT_MS / 1000}s` : err?.code || "network error";
    return { up: false, status: null, error, ms: Date.now() - started };
  }
}

/** "1 h 5 min", "12 min", "under a minute". */
export function formatDuration(ms) {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "under a minute";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

/**
 * The outage state machine, kept apart from scheduling and delivery so it can be tested.
 *
 * @param {{
 *   check: () => Promise<{ up: boolean; error: string | null }>;
 *   alert: (kind: "down" | "recovered", info: object) => Promise<void>;
 *   failuresBeforeAlert?: number;
 *   now?: () => Date;
 * }} deps
 */
export function createHealthMonitor({ check, alert, failuresBeforeAlert = 3, now = () => new Date() }) {
  const state = { consecutiveFailures: 0, downSince: null, alerted: false, lastError: null };

  const tick = async () => {
    const result = await check();
    if (result.up) {
      if (state.alerted) {
        const at = now();
        await alert("recovered", { downSince: state.downSince, upAt: at, downFor: formatDuration(at - state.downSince) });
      }
      Object.assign(state, { consecutiveFailures: 0, downSince: null, alerted: false, lastError: null });
      return { ...state };
    }
    state.consecutiveFailures += 1;
    state.lastError = result.error;
    if (!state.downSince) state.downSince = now();
    if (!state.alerted && state.consecutiveFailures >= failuresBeforeAlert) {
      state.alerted = true;
      await alert("down", { downSince: state.downSince, error: result.error, failures: state.consecutiveFailures });
    }
    return { ...state };
  };

  return { tick, state };
}

/** Extra alert addresses (e.g. an ops mailbox), comma-separated. */
const extraRecipients = () =>
  (process.env.VELOXVERSE_ALERT_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Tells every active admin / super admin (in-app + email) and the extra addresses. */
export async function sendVeloxVerseAlert(kind, info) {
  const down = kind === "down";
  const title = down ? "VeloxVerse is not responding" : "VeloxVerse is back up";
  const body = down
    ? `The CRM could not reach VeloxVerse since ${info.downSince.toISOString()} (${info.failures} checks in a row; last: ${info.error}). ` +
      "VeloxVerse pages in the CRM will fail until it is back. Check the VeloxVerse server and its database."
    : `VeloxVerse is answering again (down for ${info.downFor}, since ${info.downSince.toISOString()}).`;
  const event = down ? "veloxverse_down" : "veloxverse_recovered";

  // eslint-disable-next-line no-console
  (down ? console.error : console.log)(`[VV-Health] ${title}: ${body}`);

  let staff = [];
  try {
    staff = await User.findModerators();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[VV-Health] Could not load admins to alert:", err.message);
  }
  for (const recipient of staff) {
    try {
      await notify({ recipient, event, title, body, metadata: { downSince: info.downSince } });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[VV-Health] Alert to user ${recipient.id} failed:`, err.message);
    }
  }
  const staffEmails = new Set(staff.map((u) => u.email?.toLowerCase()).filter(Boolean));
  for (const to of extraRecipients()) {
    if (!staffEmails.has(to.toLowerCase())) await sendMail({ to, subject: title, text: body });
  }
}

/**
 * Schedule the check (default every 2 minutes; alert after 3 failures in a row ≈ 6 minutes down).
 * Disable with VELOXVERSE_HEALTH_MONITOR_DISABLED=true.
 */
export const startVeloxVerseHealthMonitor = () => {
  if (process.env.VELOXVERSE_HEALTH_MONITOR_DISABLED === "true") {
    // eslint-disable-next-line no-console
    console.log("🩺 VeloxVerse health monitor disabled (VELOXVERSE_HEALTH_MONITOR_DISABLED=true)");
    return null;
  }
  const schedule = process.env.VELOXVERSE_HEALTH_CRON || "*/2 * * * *";
  const failuresBeforeAlert = Math.max(1, parseInt(process.env.VELOXVERSE_HEALTH_FAILURES_BEFORE_ALERT, 10) || 3);
  const monitor = createHealthMonitor({ check: () => checkVeloxVerse(), alert: sendVeloxVerseAlert, failuresBeforeAlert });
  const task = cron.schedule(schedule, () => {
    monitor.tick().catch((err) =>
      // eslint-disable-next-line no-console
      console.error("[VV-Health] Check error:", err.message)
    );
  });
  // eslint-disable-next-line no-console
  console.log(`🩺 VeloxVerse health monitor started (cron: "${schedule}", alert after ${failuresBeforeAlert} failures)`);
  return task;
};

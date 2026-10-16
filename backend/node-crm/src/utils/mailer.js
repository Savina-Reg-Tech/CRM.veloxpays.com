/**
 * Email transport — the one place mail credentials are read, for every email the CRM sends
 * (password-reset codes, notifications, form submissions via services/emailService.js).
 *
 * Real backend, first match wins:
 *   1. SMTP  (SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS)
 *   2. Gmail (MAIL_USER + MAIL_APP_PASSWORD — an app password)
 * Dev fallback: a JSON transport that logs the message instead of sending,
 *               so the stack runs without mail credentials. In production that means mail is
 *               NOT delivered, and every send says so loudly.
 */
import nodemailer from "nodemailer";

const hasSmtp = Boolean(process.env.SMTP_HOST);
const hasGmail = Boolean(process.env.MAIL_USER && process.env.MAIL_APP_PASSWORD);
const isProduction = process.env.NODE_ENV === "production";

export const MAIL_FROM =
  process.env.MAIL_FROM ||
  (hasGmail && !hasSmtp ? `Velox CRM <${process.env.MAIL_USER}>` : "Velox CRM <no-reply@velox-crm.local>");

/** Whether mail actually leaves the server. */
export const isMailConfigured = () => hasSmtp || hasGmail;

/** Human-readable transport name, for the startup log. */
export const mailTransportKind = () => (hasSmtp ? "SMTP" : hasGmail ? "Gmail" : "none (logged only)");

let _transport;
export const getMailTransport = () => {
  if (_transport) return _transport;
  if (hasSmtp) {
    _transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
  } else if (hasGmail) {
    _transport = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_APP_PASSWORD },
    });
  } else {
    _transport = nodemailer.createTransport({ jsonTransport: true });
  }
  return _transport;
};

/**
 * Send an email. Never throws into the caller's flow — notification delivery
 * must not roll back a document approval. Failures are logged.
 *
 * @param {{ to: string; subject: string; text?: string; html?: string }} msg
 */
export const sendMail = async ({ to, subject, text, html }) => {
  if (!to) return;
  try {
    const info = await getMailTransport().sendMail({ from: MAIL_FROM, to, subject, text, html });
    if (!isMailConfigured()) {
      if (isProduction) {
        // eslint-disable-next-line no-console
        console.error(`📧 Email NOT sent — no mail transport configured (subject="${subject}")`);
      } else {
        // eslint-disable-next-line no-console
        console.log(`📧 [dev mail] to=${to} subject="${subject}"`);
      }
    }
    return info;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("📧 Email send failed:", err.message);
  }
};

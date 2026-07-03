/**
 * Email transport.
 *
 * Real backend: SMTP (set SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS).
 * Dev fallback: a JSON transport that logs the message instead of sending,
 *               so the stack runs without mail credentials.
 */
import nodemailer from "nodemailer";

const FROM = process.env.MAIL_FROM || "Velox CRM <no-reply@velox-crm.local>";
const hasSmtp = Boolean(process.env.SMTP_HOST);

let _transport;
const transport = () => {
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
    const info = await transport().sendMail({ from: FROM, to, subject, text, html });
    if (!hasSmtp) {
      // eslint-disable-next-line no-console
      console.log(`📧 [dev mail] to=${to} subject="${subject}"`);
    }
    return info;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("📧 Email send failed:", err.message);
  }
};

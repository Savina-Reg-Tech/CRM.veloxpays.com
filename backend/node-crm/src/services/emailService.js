/**
 * Email service — powered by Nodemailer + Gmail app password.
 *
 * Uses MAIL_USER / MAIL_APP_PASSWORD env vars.
 * If not configured, all sends are silently skipped (dev-friendly).
 */

import nodemailer from "nodemailer";
import { escapeHtml, singleLine, textToHtml } from "../utils/escapeHtml.js";

const MAIL_USER = process.env.MAIL_USER || "";
const MAIL_APP_PASSWORD = process.env.MAIL_APP_PASSWORD || "";
const MAIL_FROM = process.env.MAIL_FROM || `Velox CRM <${MAIL_USER}>`;

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  if (!MAIL_USER || !MAIL_APP_PASSWORD) return null;

  _transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: MAIL_USER,
      pass: MAIL_APP_PASSWORD,
    },
  });

  return _transporter;
}

/**
 * Send a plain-text / HTML email.
 * Silently skips if transporter is not configured.
 */
async function sendMail({ to, subject, text, html }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[emailService] No credentials configured — skipping email to ${to}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: MAIL_FROM,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject: singleLine(subject),
      text,
      // Text is never trusted as markup: anything a visitor typed is escaped.
      html: html || textToHtml(text),
    });
    console.log(`[emailService] Sent "${subject}" → ${to}`);
  } catch (err) {
    // Never crash the submission pipeline because of email failures
    console.error(`[emailService] Failed to send email:`, err.message);
  }
}

/**
 * Send admin notification when a new form submission arrives.
 *
 * @param {object} opts
 * @param {object} opts.form           - form row
 * @param {object} opts.submission     - submission row
 * @param {object} opts.lead           - lead row
 * @param {string[]} opts.notifyEmails - recipient addresses
 */
async function sendSubmissionNotification({ form, submission, lead, notifyEmails }) {
  if (!notifyEmails || notifyEmails.length === 0) return;

  const name  = lead.name  || "—";
  const email = lead.email || "—";
  const phone = lead.phone || "—";
  const score = submission.spam_score;
  const status = submission.status;

  // Everything below comes from an anonymous visitor (or, for the form name, from an admin) and
  // is shown to staff in an HTML email — escape every interpolated value.
  const displayValue = (v) => {
    if (Array.isArray(v)) return v.map(displayValue).join(", ");
    if (v && typeof v === "object") return v.__type === "file" ? `[file] ${v.originalName ?? "upload"}` : JSON.stringify(v);
    return String(v ?? "");
  };
  const entries = Object.entries(submission.submission_data ?? {}).map(([k, v]) => [k, displayValue(v)]);
  const e = escapeHtml;

  const dataRows = entries.map(([k, v]) => `  ${k}: ${v}`).join("\n");

  const text = `
New form submission received for "${form.name}"

Name:        ${name}
Email:       ${email}
Phone:       ${phone}
Status:      ${status}
Spam Score:  ${score}

Submitted data:
${dataRows || "  (no data)"}

Submitted at: ${new Date().toLocaleString()}
`.trim();

  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#4f46e5,#3b82f6);padding:24px 32px;border-radius:12px 12px 0 0">
    <h2 style="color:#fff;margin:0;font-size:18px">📋 New Form Submission</h2>
    <p style="color:#c7d2fe;margin:4px 0 0;font-size:14px">${e(form.name)}</p>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px 32px;border-radius:0 0 12px 12px">
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:6px 0;color:#6b7280;width:130px">Name</td><td style="padding:6px 0;font-weight:600">${e(name)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Email</td><td style="padding:6px 0;font-weight:600">${e(email)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Phone</td><td style="padding:6px 0;font-weight:600">${e(phone)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Status</td><td style="padding:6px 0">
        <span style="background:${status === "SPAM" ? "#fee2e2" : status === "REVIEW" ? "#fef3c7" : "#d1fae5"};
               color:${status === "SPAM" ? "#b91c1c" : status === "REVIEW" ? "#92400e" : "#065f46"};
               padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600">${e(status)}</span>
      </td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Spam Score</td><td style="padding:6px 0">${e(score)}</td></tr>
    </table>
    ${entries.length > 0 ? `
    <hr style="margin:16px 0;border:none;border-top:1px solid #f3f4f6">
    <p style="font-size:13px;font-weight:600;color:#374151;margin-bottom:8px">Submitted Data</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      ${entries.map(([k, v]) => `
      <tr>
        <td style="padding:4px 0;color:#6b7280;width:130px">${e(k)}</td>
        <td style="padding:4px 0">${e(v)}</td>
      </tr>`).join("")}
    </table>` : ""}
    <p style="font-size:12px;color:#9ca3af;margin-top:20px">Submitted at ${new Date().toLocaleString()}</p>
  </div>
</div>
`;

  await sendMail({ to: notifyEmails, subject: `New submission: ${form.name}`, text, html });
}

/**
 * Send auto-responder confirmation email to the person who submitted.
 *
 * @param {object} opts
 * @param {object} opts.form    - form row (has auto_respond_subject, auto_respond_body)
 * @param {object} opts.lead    - lead row (has email, name)
 * @param {object} opts.data    - raw submission data
 */
async function sendAutoResponder({ form, lead, data }) {
  if (!lead.email) return;

  const name = lead.name || "there";

  // Replace simple template tokens: {{name}}, {{email}}, {{phone}}, plus any field id
  const replace = (str) =>
    str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (key === "name")  return name;
      if (key === "email") return lead.email || "";
      if (key === "phone") return lead.phone || "";
      return data[key] !== undefined ? String(data[key]) : `{{${key}}}`;
    });

  const subject = replace(form.auto_respond_subject || "Thanks for reaching out!");
  const body    = replace(form.auto_respond_body    || `Hi {{name}},\n\nThank you for your submission.\n\nBest regards,\nThe Team`);

  // No `html` passed on purpose: sendMail builds it from the text with everything escaped, so a
  // submitted "name" can never become a link or markup in an email sent from our account.
  await sendMail({ to: lead.email, subject, text: body });
}

export { sendMail, sendSubmissionNotification, sendAutoResponder };

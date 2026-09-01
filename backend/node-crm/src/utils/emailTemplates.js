/**
 * Shared HTML shell + templates for security-related account emails (OTP
 * codes, password-changed confirmations). Keeping these in one place means
 * every such email shares the same look instead of drifting — a plain-text
 * one and a styled one sitting side by side reads as broken, not deliberate.
 *
 * Every template returns { subject, text, html } — always pass all three to
 * mailer.js's sendMail(): text is the fallback for clients that don't render
 * HTML, html is what most inboxes will actually show.
 */

const BRAND = {
  gradientFrom: "#4f46e5",
  gradientTo: "#3b82f6",
  text: "#111827",
  muted: "#6b7280",
  border: "#e5e7eb",
  bgTint: "#eef2ff",
  codeText: "#1e3a8a",
  codeBorder: "#c7d2fe",
  warnBg: "#fef2f2",
  warnBorder: "#fecaca",
  warnText: "#991b1b",
};

/** Common card shell every templated email is wrapped in. */
function emailShell(heading, bodyHtml) {
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto">
  <div style="background:linear-gradient(135deg,${BRAND.gradientFrom},${BRAND.gradientTo});padding:24px 32px;border-radius:12px 12px 0 0">
    <h2 style="color:#fff;margin:0;font-size:18px">${heading}</h2>
  </div>
  <div style="background:#fff;border:1px solid ${BRAND.border};border-top:none;padding:24px 32px;border-radius:0 0 12px 12px">
    ${bodyHtml}
  </div>
  <p style="text-align:center;font-size:11px;color:#9ca3af;margin:16px 0 0">Velox CRM · This is an automated security notification.</p>
</div>`;
}

/**
 * "Here's your reset code" email — the self-service Forgot-password OTP.
 */
export function otpEmailTemplate(name, otp, expiryMinutes) {
  const bodyHtml = `
    <p style="font-size:14px;color:${BRAND.text};margin:0 0 8px">Hi ${name || "there"},</p>
    <p style="font-size:14px;color:${BRAND.text};line-height:1.6;margin:0 0 20px">
      We received a request to reset your password. Use the code below to continue.
    </p>
    <div style="text-align:center;margin:0 0 20px">
      <span style="display:inline-block;font-size:30px;font-weight:700;letter-spacing:8px;
                   color:${BRAND.codeText};background:${BRAND.bgTint};border:1px solid ${BRAND.codeBorder};
                   border-radius:10px;padding:14px 20px">${otp}</span>
    </div>
    <p style="font-size:13px;color:${BRAND.muted};margin:0">
      This code expires in <strong style="color:${BRAND.text}">${expiryMinutes} minutes</strong>. If you
      didn't request this, you can safely ignore this email — your password will not be changed.
    </p>`;

  return {
    subject: "Your Velox CRM password reset code",
    text: `Your password reset code is ${otp}. It expires in ${expiryMinutes} minutes. If you didn't request this, you can safely ignore this email.`,
    html: emailShell("Reset your Velox CRM password", bodyHtml),
  };
}

/**
 * "Your password was just changed" confirmation — sent after a successful
 * reset (self-service OTP flow or an admin-triggered reset), so the account
 * owner has a paper trail and a clear way to react if it wasn't them.
 */
export function passwordChangedEmailTemplate(name, { changedAt = new Date(), reason } = {}) {
  const when = changedAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const reasonLine = reason
    ? `<p style="font-size:14px;color:${BRAND.text};line-height:1.6;margin:0 0 16px">${reason}</p>`
    : "";

  const bodyHtml = `
    <p style="font-size:14px;color:${BRAND.text};margin:0 0 8px">Hi ${name || "there"},</p>
    <div style="display:flex;align-items:center;gap:10px;margin:0 0 16px">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;
                   border-radius:999px;background:#d1fae5;color:#065f46;font-size:18px;flex-shrink:0">&#10003;</span>
      <p style="font-size:14px;color:${BRAND.text};line-height:1.5;margin:0">
        Your password was changed on <strong>${when}</strong>.
      </p>
    </div>
    ${reasonLine}
    <div style="background:${BRAND.warnBg};border:1px solid ${BRAND.warnBorder};border-radius:10px;padding:14px 16px">
      <p style="font-size:13px;color:${BRAND.warnText};line-height:1.6;margin:0">
        <strong>Wasn't you?</strong> Contact your administrator immediately — your account may be compromised.
      </p>
    </div>`;

  return {
    subject: "Your Velox CRM password was changed",
    text: `Your Velox CRM password was changed on ${when}.${reason ? ` ${reason}` : ""} If this wasn't you, contact your administrator immediately.`,
    html: emailShell("Password changed", bodyHtml),
  };
}

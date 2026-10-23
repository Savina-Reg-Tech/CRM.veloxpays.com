import axios from "axios";
import jwt from "jsonwebtoken";

const VV_BASE = process.env.VELOXVERSE_API_URL || "http://localhost:5005/api/v1";

/**
 * VeloxVerse audit columns (e.g. points_config.updated_by) require a VeloxVerse
 * user UUID. Map CRM admin emails to matching VeloxVerse admin emails before
 * forwarding X-CRM-User-Email.
 *
 * Priority:
 *  1. VELOXVERSE_BRIDGE_USER_EMAIL — single override for all proxied requests
 *  2. VELOXVERSE_BRIDGE_EMAIL_MAP — comma-separated pairs: crm@x.com:vv@y.com
 *  3. CRM user's own email
 */
function bridgeUserEmail(crmEmail) {
  const globalOverride = process.env.VELOXVERSE_BRIDGE_USER_EMAIL?.trim();
  if (globalOverride) return globalOverride;

  const normalized = (crmEmail || "").trim().toLowerCase();
  const mapRaw = process.env.VELOXVERSE_BRIDGE_EMAIL_MAP?.trim();
  if (mapRaw && normalized) {
    for (const pair of mapRaw.split(",")) {
      const sep = pair.indexOf(":");
      if (sep === -1) continue;
      const from = pair.slice(0, sep).trim().toLowerCase();
      const to = pair.slice(sep + 1).trim();
      if (from && to && from === normalized) return to;
    }
  }

  return crmEmail || "";
}

/** How long a bridge token lives. VeloxVerse refuses tokens with no expiry or a lifetime over
 * 12 hours; 15 minutes is the agreed value. A new one is signed for every request anyway. */
export const BRIDGE_TOKEN_TTL_SECONDS = 15 * 60;

/** Shown when VeloxVerse still refuses the token after one fresh re-sign. */
export const BRIDGE_REJECTED_MESSAGE = "VeloxVerse rejected the CRM connection — contact the administrator";

/**
 * The token VeloxVerse sees for this request — admin access to VeloxVerse, so it is kept as
 * short-lived and as hard to misuse as possible:
 *
 *  - Signed fresh for EVERY request, on the server, and never stored anywhere (no env var,
 *    database, cache or browser). The browser never receives it.
 *  - Always expires (`iat` + `exp`, 15 minutes apart). VeloxVerse production refuses a token
 *    with no expiry or a lifetime over 12 hours.
 *  - `role` is the CRM user's real, current role, read from the database by `authenticate` for
 *    this very request — not the role inside the browser's (days-old) session cookie. A CRM
 *    admin can never be sent as `super_admin`.
 *  - `email` is the acting person's email from that same database row, inside the signature, so
 *    nobody holding a token can claim to be someone else by changing a header.
 *  - `iss` / `aud` are added only when VELOXVERSE_BRIDGE_ISSUER / VELOXVERSE_BRIDGE_AUDIENCE
 *    are set — to be switched on together with VeloxVerse's CRM_JWT_ISSUER / CRM_JWT_AUDIENCE,
 *    never one-sidedly.
 *
 * @param {{ id: number | string; role: string; email?: string }} user — req.user (from the database)
 */
export function signBridgeToken(user) {
  const issuer = process.env.VELOXVERSE_BRIDGE_ISSUER?.trim();
  const audience = process.env.VELOXVERSE_BRIDGE_AUDIENCE?.trim();
  return jwt.sign(
    { id: user.id, role: user.role, email: bridgeUserEmail(user.email) },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: BRIDGE_TOKEN_TTL_SECONDS,
      ...(issuer ? { issuer } : {}),
      ...(audience ? { audience } : {}),
    }
  );
}

/**
 * The path as the upstream will read it, or `null` when it must not be forwarded.
 *
 * axios resolves "." / ".." segments (encoded or not) before sending, so a path that passed a
 * role check on its raw form could land on a different endpoint. Anything that changes meaning
 * between here and VeloxVerse is rejected: dot segments, encoded slashes / backslashes, empty
 * segments, control characters and malformed escapes.
 *
 * @param {string} rawPath — req.path (no query string)
 * @returns {string | null}
 */
export function decodeProxyPath(rawPath) {
  if (typeof rawPath !== "string" || !rawPath.startsWith("/")) return null;
  if (/%2f|%5c/i.test(rawPath) || rawPath.includes("\\") || rawPath.includes("//")) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(decoded)) return null;
  if (decoded.split("/").some((segment) => segment === "." || segment === "..")) return null;
  return decoded;
}

/**
 * Whether the upstream answers this path with a file rather than JSON:
 *  - a CSV export (…/export.csv);
 *  - a ViaTovia email attachment (/admin/assist/transfer/inbox/:id/attachments/:attachmentId).
 *
 * @param {string} path — req.path (no query string)
 * @returns {boolean}
 */
export function isFileDownloadPath(path) {
  if (typeof path !== "string") return false;
  return path.endsWith(".csv") || /^\/admin\/assist\/transfer\/inbox\/[^/]+\/attachments\/[^/]+$/.test(path);
}

/**
 * Forward any request from /api/vv-admin/* to the VeloxVerse backend.
 *
 * The path is forwarded as-is (minus the /api/vv-admin prefix, which is
 * stripped by Express when this is mounted at /api/vv-admin).
 *
 * Auth: mounted after `authenticate`, so req.user is the CRM user as stored in the database.
 * A short-lived token carrying that user's id and current role is sent as the Bearer token
 * (see signBridgeToken) and their own email as X-CRM-User-Email — both built here on the
 * server; no header, query parameter or body field from the browser feeds into either.
 * VeloxVerse's CRM bridge middleware verifies the token with the shared CRM_JWT_SECRET.
 */
export default async function veloxverseProxy(req, res) {
  if (!req.user?.id || !req.user?.role) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  if (decodeProxyPath(req.path) === null) {
    return res.status(400).json({ success: false, message: "Invalid request path." });
  }

  // Build the target URL: req.url already includes the query string
  // (e.g. /admin/analytics/overview?period=30d), so do NOT pass req.query
  // separately — axios would duplicate every parameter.
  // Use req.originalUrl to get the path after the mount point, but req.url
  // is already stripped by Express when mounted at /api/vv-admin.
  const targetUrl = `${VV_BASE}${req.url}`;
  // File downloads (the audit log's export.csv, Pick & Drop email PDFs) are passed through as raw
  // bytes with their download headers; everything else is JSON.
  const isFile = isFileDownloadPath(req.path);

  try {
    // One call to VeloxVerse with a freshly signed token. The acting email travels inside the
    // signed token; the header carries the same value for older VeloxVerse versions.
    const callVeloxVerse = () =>
      axios({
        method: req.method,
        url: targetUrl,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${signBridgeToken(req.user)}`,
          "X-CRM-User-Email": bridgeUserEmail(req.user?.email),
        },
        data: ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) ? req.body : undefined,
        // Don't let axios parse the response — we stream it as-is
        validateStatus: () => true,
        ...(isFile ? { responseType: "arraybuffer" } : {}),
        // Timeout: 30s for long analytics queries
        timeout: 30000,
      });

    let response = await callVeloxVerse();
    // A 401 means VeloxVerse refused the token before doing anything, so asking again is safe
    // even for a write. Re-sign and retry exactly once — never a loop.
    if (response.status === 401) {
      response = await callVeloxVerse();
    }

    // A VeloxVerse 401 must not be forwarded as 401 — the CRM frontend treats any 401 as
    // "CRM session expired" and redirects to /login. By this point CRM authenticate already
    // passed, so an upstream 401 is an integration/config issue (bridge off, secret mismatch),
    // not a reason to log the user out of the CRM. (403 is handled further down.)
    if (isFile && response.status < 400) {
      for (const h of ["content-type", "content-disposition", "content-length", "x-export-rows", "x-export-truncated", "x-request-id"]) {
        if (response.headers[h] !== undefined) res.set(h, response.headers[h]);
      }
      return res.status(response.status).send(Buffer.from(response.data));
    }
    // A failed file request comes back as JSON bytes — decode so the frontend gets the usual body.
    if (isFile) {
      try {
        response.data = JSON.parse(Buffer.from(response.data).toString("utf8"));
      } catch {
        response.data = { success: false, message: "VeloxVerse export failed." };
      }
    }

    // A 403 is VeloxVerse answering "this person may not do that" (e.g. "Only a super admin can
    // change a user's role.") — a real answer for the admin, passed through with its message
    // unchanged. The CRM frontend only logs out on 401, so a 403 is safe to forward.
    if (response.status === 403) {
      return res.status(403).json(response.data);
    }

    if (response.status === 401) {
      // Still refused after a fresh token: a setup problem between the two systems (bridge
      // switched off, secrets differ, issuer/audience set on one side only). Tell the admin
      // plainly; the reason goes to the server log (never the token or the secret).
      console.error(
        `[VV-Proxy] VeloxVerse rejected the bridge token twice (${req.method} ${req.path}): ${response.data?.message ?? "no reason given"}. ` +
          "Check that VeloxVerse has CRM_BRIDGE_ENABLED=true, that its CRM_JWT_SECRET equals this CRM's JWT_SECRET, and that issuer/audience are set on both sides or neither."
      );
      return res.status(502).json({
        success: false,
        code: "VELOXVERSE_BRIDGE_REJECTED",
        // Keep VeloxVerse's request id so the CRM can show "Ref: …" for support to trace.
        requestId: response.data?.requestId,
        message: BRIDGE_REJECTED_MESSAGE,
      });
    }

    // Forward the VeloxVerse response status + body to the CRM frontend
    res.status(response.status).json(response.data);
  } catch (err) {
    console.error("[VV-Proxy] Error forwarding to VeloxVerse:", err.message);
    if (err.code === "ECONNREFUSED") {
      return res.status(502).json({
        success: false,
        message: "VeloxVerse service is not available. Please try again later.",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Failed to connect to VeloxVerse service.",
    });
  }
}

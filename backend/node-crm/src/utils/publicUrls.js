/**
 * Public base URLs handed to the outside world: in embed codes, and inside the cached /form.js.
 *
 * The request's Host header is attacker-controlled. It is only a fallback, it must look like a
 * plain host[:port], and anything built from it must not be cached publicly (see
 * handleServeEmbedScript) — otherwise one crafted request could point every embedded form at
 * someone else's server.
 */

const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$/i;

const trimSlash = (url) => url.trim().replace(/\/+$/, "");

/** `${protocol}://${host}` from the request, or null when the Host header is not a plain host. */
export function requestOrigin(req) {
  const host = req.get("host") ?? "";
  return HOST_RE.test(host) ? `${req.protocol}://${host}` : null;
}

/**
 * Where the API (and /form.js, /public/*) is reachable from the public internet.
 * @returns {{ url: string | null; configured: boolean }}
 */
export function publicApiBase(req) {
  const configured = process.env.PUBLIC_API_BASE?.trim();
  if (configured) return { url: trimSlash(configured), configured: true };
  return { url: requestOrigin(req), configured: false };
}

/**
 * Where the CRM web app (and its /embed/:id page) is served. In production that is a different
 * host from the API, so the API's own host is only the last resort.
 * @returns {string | null}
 */
export function publicAppBase(req) {
  const configured = process.env.PUBLIC_APP_URL?.trim();
  if (configured) return trimSlash(configured);
  const firstOrigin = (process.env.ALLOWED_ORIGINS ?? "").split(",")[0]?.trim();
  if (firstOrigin) return trimSlash(firstOrigin);
  return requestOrigin(req);
}

/**
 * URLs an admin can configure on a form (redirect after submit, step-button links) end up in
 * `window.location` / `window.open` on the public form page. A `javascript:` (or `data:`,
 * `vbscript:` …) URL there runs script on the CRM's own origin for whoever submits the form.
 *
 * Allowed: http(s) URLs, a bare host or path with no scheme ("www.site.com/x" — the form page
 * prefixes https://), and same-site paths starting with a single "/". Everything else is refused.
 * The frontend applies the same rule at the point of use (features/forms/utils/url.ts).
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSafeLinkUrl(value) {
  if (typeof value !== "string") return false;
  const url = value.trim();
  if (url === "") return true; // "not set yet" — the builder saves drafts with empty fields
  // Browsers ignore tabs / newlines / control characters inside a URL, so "java\tscript:" works.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(url)) return false;
  if (url.startsWith("//")) return true; // protocol-relative → treated as https://host
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url);
  if (!scheme) return true; // relative path or bare host
  return ["http", "https"].includes(scheme[1].toLowerCase());
}

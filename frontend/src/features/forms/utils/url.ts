// Shared by the builder's URL inputs (OnSubmitActionPicker, StepButtonsModal)
// and the live/embedded form renderer (PublicFormPage), so a URL always
// means the same thing wherever it's typed or used.

/** An admin typing "www.veloxpays.com" (no scheme) into an external-URL
 * field means "go to that website" — but handed straight to
 * `window.location.href`/`window.open`, a browser treats a schemeless
 * string as a path *relative to the current page*, not a new host. From
 * `/embed/:id` that resolves to `.../embed/www.veloxpays.com` instead of
 * `https://www.veloxpays.com`, so the redirect silently 404s on our own
 * domain. Prepending `https://` when no scheme (or protocol-relative `//`)
 * is present makes it behave the way it obviously was meant to.
 *
 * Deliberately NOT applied to "Redirect to a page" (pageUrl) — that field
 * intentionally accepts a bare relative path like "/thank-you" on the CRM's
 * own domain, and forcing a scheme there would break it. */
export function ensureAbsoluteUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed || /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('//')) return trimmed
  return `https://${trimmed}`
}

/**
 * A link that is safe to hand to `window.location` / `window.open` / `<a href>`, or `null`.
 *
 * Form redirects, step-button links and inline links are typed by an admin and then run in
 * every visitor's browser on the CRM's own origin — a `javascript:` (or `data:` …) URL there
 * executes script as that visitor. Only http(s) links and relative paths get through;
 * `mailto:` / `tel:` too when `allowContact` is set (plain `<a href>` only — never a redirect).
 * The backend enforces the same rule when a form is saved (utils/safeUrl.js); this is the check
 * at the point of use, which also covers forms saved before that rule existed.
 */
export function safeLinkUrl(url: string | null | undefined, opts: { allowContact?: boolean } = {}): string | null {
  if (typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null
  // Browsers ignore tabs / newlines / control characters inside a URL ("java\tscript:").
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return null
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed)
  if (!scheme) return trimmed // relative path
  const s = scheme[1].toLowerCase()
  if (s === 'http' || s === 'https') return trimmed
  if (opts.allowContact && (s === 'mailto' || s === 'tel')) return trimmed
  return null
}

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

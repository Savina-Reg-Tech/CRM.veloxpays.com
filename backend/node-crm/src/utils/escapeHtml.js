const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escape a value for use in HTML text or a quoted attribute. */
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** Plain text → HTML: escaped, with line breaks kept. */
export function textToHtml(text) {
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

/** One line, bounded — for email subjects built from submitted values (no header injection). */
export function singleLine(value, max = 200) {
  return String(value ?? "").replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);
}

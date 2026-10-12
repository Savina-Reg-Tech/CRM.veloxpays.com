/**
 * Storage keys and file checks shared by both storage adapters.
 */

/**
 * A storage key is a relative path we generate ourselves ("verification/user-3/passport-<uuid>.pdf").
 * It must never be able to leave its folder — on local disk that would be a path traversal, in
 * S3 it would let one user's upload overwrite or masquerade as another's object.
 *
 * @param {unknown} key
 * @returns {string} the key, unchanged
 */
export function assertSafeKey(key) {
  if (
    typeof key !== "string" ||
    key === "" ||
    key.length > 512 ||
    key.startsWith("/") ||
    key.includes("\\") ||
    key.includes("\0") ||
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u001f\u007f]/.test(key) ||
    key.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw Object.assign(new Error("Invalid storage path"), { status: 400 });
  }
  return key;
}

/** `inline; filename="…"` for a download, safe for any original file name. */
export function contentDisposition(fileName) {
  // eslint-disable-next-line no-control-regex
  const clean = String(fileName || "file").replace(/[\u0000-\u001f\u007f"\\\/]/g, "").trim().slice(0, 150) || "file";
  const ascii = clean.replace(/[^\x20-\x7e]/g, "_");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(clean)}`;
}

// ── File content checks ─────────────────────────────────────────────────────
// The MIME type a browser sends is just a label the uploader chose. Before a file is stored,
// its first bytes must actually look like the type it claims to be.

const startsWith = (buffer, bytes, offset = 0) =>
  buffer.length >= offset + bytes.length && bytes.every((b, i) => buffer[offset + i] === b);

const SIGNATURES = {
  "application/pdf": (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46]), // %PDF
  "image/jpeg": (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  "image/png": (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  // Legacy .doc — OLE compound file
  "application/msword": (b) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  // .docx — a zip archive
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]),
};

/**
 * @param {Buffer} buffer
 * @param {string} mimeType — the type the upload claims to be
 * @returns {boolean} false when the content does not match (or the type is not one we store)
 */
export function contentMatchesType(buffer, mimeType) {
  const check = SIGNATURES[mimeType];
  return !!check && Buffer.isBuffer(buffer) && check(buffer);
}

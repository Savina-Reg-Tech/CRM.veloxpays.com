/**
 * Local-disk storage adapter (development fallback).
 * Files live under STORAGE_LOCAL_DIR; they are served via the authenticated
 * download route, so fileUrl is a relative API path, not a public URL.
 *
 * Not for production on a container host: the container's disk is thrown away on every deploy
 * or restart, and uploaded documents with it. Use S3 there (see s3Storage.js).
 */
import { promises as fs } from "fs";
import path from "path";
import { assertSafeKey } from "./keys.js";

const ROOT = path.resolve(
  process.env.STORAGE_LOCAL_DIR || path.join(process.cwd(), "uploads")
);

/** Absolute path for a key — guaranteed to stay inside ROOT. */
function resolveInsideRoot(key) {
  const dest = path.resolve(ROOT, assertSafeKey(key));
  if (dest !== ROOT && !dest.startsWith(ROOT + path.sep)) {
    throw Object.assign(new Error("Invalid storage path"), { status: 400 });
  }
  return dest;
}

export const localStorage = {
  kind: "local",

  describe() {
    return { kind: "local", directory: ROOT };
  },

  /**
   * @param {object} args
   * @param {string} args.key     storage key (relative path, e.g. "verification/user-3/passport-uuid.pdf")
   * @param {Buffer} args.buffer
   * @param {string} args.contentType
   * @returns {Promise<{ storagePath: string; fileUrl: string | null }>}
   */
  async put({ key, buffer }) {
    const dest = resolveInsideRoot(key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buffer);
    // URL is resolved per-document by the download route; nothing public here.
    return { storagePath: key, fileUrl: null };
  },

  /** @param {string} key */
  async remove(key) {
    try {
      await fs.unlink(resolveInsideRoot(key));
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  },

  /** Local files have no signed URL — the download route streams them instead. */
  async getSignedUrl() {
    return null;
  },

  /** @param {string} key @returns {Promise<Buffer>} */
  async read(key) {
    return fs.readFile(resolveInsideRoot(key));
  },

  /** Is the upload folder writable? Never throws. */
  async check() {
    try {
      await fs.mkdir(ROOT, { recursive: true });
      await fs.access(ROOT, fs.constants.W_OK);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },
};

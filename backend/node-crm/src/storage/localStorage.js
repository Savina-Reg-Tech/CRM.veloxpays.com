/**
 * Local-disk storage adapter (development fallback).
 * Files live under STORAGE_LOCAL_DIR; they are served via the authenticated
 * download route, so fileUrl is a relative API path, not a public URL.
 */
import { promises as fs } from "fs";
import path from "path";

const ROOT = path.resolve(
  process.env.STORAGE_LOCAL_DIR || path.join(process.cwd(), "uploads")
);

export const localStorage = {
  kind: "local",

  /**
   * @param {object} args
   * @param {string} args.key     storage key (relative path, e.g. "user-3/passport-uuid.pdf")
   * @param {Buffer} args.buffer
   * @param {string} args.contentType
   * @returns {Promise<{ storagePath: string; fileUrl: string | null }>}
   */
  async put({ key, buffer }) {
    const dest = path.join(ROOT, key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, buffer);
    // URL is resolved per-document by the download route; nothing public here.
    return { storagePath: key, fileUrl: null };
  },

  /** @param {string} key */
  async remove(key) {
    try {
      await fs.unlink(path.join(ROOT, key));
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  },

  /** Local files have no signed URL — caller streams via readStream(). */
  async getSignedUrl() {
    return null;
  },

  /** @param {string} key @returns {Promise<Buffer>} */
  async read(key) {
    return fs.readFile(path.join(ROOT, key));
  },
};

/**
 * Pluggable document storage.
 *
 * Real backend: AWS S3 (set S3_BUCKET + AWS_REGION + credentials).
 * Dev fallback: local disk under STORAGE_LOCAL_DIR, served through the
 *               authenticated download route (/api/verification/documents/:id/file).
 *
 * The adapter never lets file bytes touch Postgres — it returns
 * { storagePath, fileUrl } metadata that the DB stores.
 */
import { localStorage } from "./localStorage.js";
import { s3Storage } from "./s3Storage.js";

const useS3 = Boolean(process.env.S3_BUCKET);

/** @type {{ kind: string; describe: Function; put: Function; remove: Function; getSignedUrl: Function; read: Function; check: Function }} */
export const storage = useS3 ? s3Storage : localStorage;

export { assertSafeKey, contentDisposition, contentMatchesType } from "./keys.js";

/**
 * Where uploaded documents live right now, and whether that place is reachable — for the
 * startup log and the CRM Settings page. Never throws.
 */
export async function storageStatus() {
  const info = storage.describe();
  const check = await storage.check();
  // A container's own disk does not survive a deploy or restart: in production, documents kept
  // on local disk will be lost.
  const durable = info.kind === "s3";
  return {
    ...info,
    ok: check.ok,
    error: check.ok ? null : check.error,
    durable,
    warning:
      !durable && process.env.NODE_ENV === "production"
        ? "Documents are being saved on the server's own disk. On a container host they are lost at the next deploy or restart. Set S3_BUCKET to store them in S3."
        : null,
  };
}

if (!useS3) {
  // eslint-disable-next-line no-console
  console.log(
    "🗄️  Document storage: LOCAL disk (set S3_BUCKET to use S3 in production)"
  );
} else {
  // eslint-disable-next-line no-console
  console.log(`🗄️  Document storage: S3 bucket "${process.env.S3_BUCKET}"`);
}

export const ALLOWED_MIME_TYPES = Object.freeze([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

/** Map MIME → canonical file extension for generated storage keys. */
export const MIME_EXTENSION = Object.freeze({
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
});

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB (spec)

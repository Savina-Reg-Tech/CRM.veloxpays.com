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

// A container's own disk is wiped at every deploy, so in production a new upload saved there is a
// document silently lost later. Refuse new uploads instead (reads still work, for anything already
// on disk). ALLOW_LOCAL_STORAGE=true opts back in where the disk is a persistent volume, e.g. the
// local docker compose stack, which also runs with NODE_ENV=production.
const localUploadsRefused =
  !useS3 && process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_STORAGE !== "true";

const refusingLocalStorage = {
  ...localStorage,
  put: async () => {
    throw Object.assign(
      new Error("File uploads are unavailable: document storage is not configured on the server."),
      { status: 503 }
    );
  },
};

/** @type {{ kind: string; describe: Function; put: Function; remove: Function; getSignedUrl: Function; read: Function; check: Function }} */
export const storage = useS3 ? s3Storage : localUploadsRefused ? refusingLocalStorage : localStorage;

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
    warning: localUploadsRefused
      ? "S3_BUCKET is not set, so new document and form-file uploads are REFUSED (the server's own disk is lost at the next deploy). Set S3_BUCKET, or ALLOW_LOCAL_STORAGE=true if this disk is persistent."
      : !durable && process.env.NODE_ENV === "production"
        ? "Documents are being saved on the server's own disk (ALLOW_LOCAL_STORAGE=true). Make sure it is a persistent volume."
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

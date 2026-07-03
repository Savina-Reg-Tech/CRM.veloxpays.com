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

/** @type {{ kind: string; put: Function; remove: Function; getSignedUrl: Function }} */
export const storage = useS3 ? s3Storage : localStorage;

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

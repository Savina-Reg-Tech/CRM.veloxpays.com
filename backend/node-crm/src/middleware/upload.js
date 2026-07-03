/**
 * Multipart upload middleware for verification documents.
 * Uses in-memory storage so the storage adapter (S3 / local) owns persistence.
 * Enforces the 10 MB cap and the PDF/JPG/JPEG/PNG allowlist from the spec.
 */
import multer from "multer";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "../storage/index.js";

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  const err = new Error(
    "Unsupported file type. Allowed: PDF, JPG, JPEG, PNG"
  );
  err.status = 400;
  cb(err);
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter,
});

/**
 * Express middleware: parse a single `file` field, normalizing multer's
 * limit/type errors into our standard 400 JSON shape.
 */
export const uploadSingleDocument = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    const status = err.code === "LIMIT_FILE_SIZE" ? 400 : err.status || 400;
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File too large. Maximum size is 10 MB."
        : err.message || "Upload failed";
    return res.status(status).json({ success: false, message });
  });
};

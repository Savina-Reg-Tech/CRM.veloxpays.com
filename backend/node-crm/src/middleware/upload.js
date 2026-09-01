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

/**
 * Multipart upload middleware for Form Builder "file" fields on PUBLIC (anonymous) form
 * submissions. Deliberately a separate multer instance + allowlist from `uploadSingleDocument`
 * above — that one's allowlist is compliance-scoped for identity-verification documents and
 * shouldn't be loosened (or tightened) by an unrelated, anonymous-facing feature. Uses
 * `.any()` because a form's file field id (hence the multipart field name) is defined by
 * whoever built the form, not known ahead of time — and caps both per-file size and file count
 * since, unlike verification uploads, this endpoint has no logged-in user behind it.
 */
export const FORM_UPLOAD_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
export const FORM_UPLOAD_MIME_EXTENSION = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};
export const FORM_UPLOAD_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file
const FORM_UPLOAD_MAX_FILES = 5;

const formUploadFileFilter = (_req, file, cb) => {
  if (FORM_UPLOAD_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(null, true);
  }
  const err = new Error("Unsupported file type. Allowed: PDF, JPG, PNG, DOC, DOCX");
  err.status = 400;
  cb(err);
};

const formUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FORM_UPLOAD_MAX_FILE_SIZE_BYTES, files: FORM_UPLOAD_MAX_FILES },
  fileFilter: formUploadFileFilter,
});

/**
 * Express middleware for POST /public/forms/:id/submit. The React embed (PublicFormPage.tsx)
 * always posts multipart now — a single JSON `payload` field carries the regular field
 * answers (preserving checkbox arrays / nested shapes exactly, no server-side reconstruction
 * needed) alongside one multipart part per file actually selected. multer's `.any()` only acts
 * on requests whose Content-Type is multipart/*, so this is a no-op passthrough for the legacy
 * plain-JSON `/form.js` embed widget, which never had file fields to begin with.
 */
export const uploadFormSubmissionFiles = (req, res, next) => {
  formUpload.any()(req, res, (err) => {
    if (!err) return next();
    const status = err.status || 400;
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? `File too large. Maximum size is ${FORM_UPLOAD_MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`
        : err.code === "LIMIT_FILE_COUNT"
          ? `Too many files. Maximum is ${FORM_UPLOAD_MAX_FILES} per submission.`
          : err.message || "Upload failed";
    return res.status(status).json({ success: false, message });
  });
};

import { Router } from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import { uploadSingleDocument } from "../middleware/upload.js";
import {
  handleGetMeta,
  handleUploadDocument,
  handleGetMyDocuments,
  handleGetMyProgress,
  handleReviewDocument,
  handleListForReview,
  handleGetUserDetail,
  handleActivate,
  handleSuspend,
  handleRejectVerification,
  handleDownloadDocument,
  handleGetPendingVerificationCount,
} from "../controllers/verificationController.js";

const router = Router();

router.use(authenticate);

// ── Meta ─────────────────────────────────────────────────────────────────────
router.get("/meta", handleGetMeta);

// ── Acting user's own verification ───────────────────────────────────────────
router.post("/documents", uploadSingleDocument, handleUploadDocument);
router.get("/documents/me", handleGetMyDocuments);
router.get("/me/progress", handleGetMyProgress);

// Secure download — owner or moderator (RBAC enforced in the service).
router.get("/documents/:id/file", handleDownloadDocument);

// ── Moderator review portal (super_admin / admin) ────────────────────────────
const moderators = authorizeRoles("super_admin", "admin");

router.get("/review/pending-count", moderators, handleGetPendingVerificationCount);
router.get("/review", moderators, handleListForReview);
router.get("/review/:userId", moderators, handleGetUserDetail);
router.patch("/documents/:id/status", moderators, handleReviewDocument);
router.post("/users/:userId/activate", moderators, handleActivate);
router.post("/users/:userId/suspend", moderators, handleSuspend);
router.post("/users/:userId/reject", moderators, handleRejectVerification);

export default router;

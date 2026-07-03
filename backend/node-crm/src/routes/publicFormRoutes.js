import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  handleGetPublicForm,
  handleSubmitForm,
  handleValidateEmail,
  handleServeEmbedScript,
} from "../controllers/publicFormController.js";

const router = Router();

// ── Submission rate limiter: 10 per IP per 15 minutes ────────────
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many submissions from this IP. Please try again later." },
  skipSuccessfulRequests: false,
});

// ── Email validation rate limiter: 60 checks per IP per minute ───
const validateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many validation requests. Please slow down." },
});

// ── Routes ────────────────────────────────────────────────────────
router.get("/forms/:id",          handleGetPublicForm);
router.post("/forms/:id/submit",  submissionLimiter, handleSubmitForm);
router.get("/validate-email",     validateLimiter,   handleValidateEmail);
router.get("/form.js",            handleServeEmbedScript);

export default router;

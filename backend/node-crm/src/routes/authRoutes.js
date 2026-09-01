import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, logout, getMe, forgotPassword, resetPassword } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Throttle login attempts per source IP to blunt brute-force / credential
// stuffing. Successful logins do not count against the limit so a legitimate
// user is never locked out by their own success.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                  // max failed attempts per IP per window
  standardHeaders: true,    // RateLimit-* headers
  legacyHeaders: false,     // disable X-RateLimit-* headers
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message:
      "Too many login attempts from this IP. Please wait 15 minutes and try again.",
  },
});

// Limits how often a given IP can request a reset code — otherwise this
// endpoint could be used to spam an inbox (or, combined with a slow email
// provider, to probe which addresses have accounts).
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many reset requests from this IP. Please wait 15 minutes and try again.",
  },
});

// Limits how many OTP-verify attempts a given IP can make. Combined with the
// per-code attempt cap in passwordResetService.js, this is defense in depth
// against brute-forcing a 6-digit code (1,000,000 possibilities).
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message:
      "Too many attempts from this IP. Please wait 15 minutes and try again.",
  },
});

router.post("/login",  loginLimiter, login);
router.post("/logout", logout);
router.get("/me",      authenticate, getMe);
router.post("/forgot-password", forgotPasswordLimiter, forgotPassword);
router.post("/reset-password",  resetPasswordLimiter,  resetPassword);

export default router;

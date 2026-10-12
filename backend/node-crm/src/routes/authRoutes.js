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

// Per-account limits, on top of the per-IP ones above: a reset code is 6 digits, so what must
// be bounded is guesses per ACCOUNT, however many addresses they come from. Keyed on the
// submitted email whether or not it belongs to an account, so the limit itself reveals nothing.
const emailKey = (req) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  return `email:${email.slice(0, 320)}`;
};
const hasEmail = (req) => typeof req.body?.email === "string" && req.body.email.trim() !== "";

// At most 3 codes per account per 15 minutes (each code allows 5 guesses).
const forgotPasswordAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailKey,
  skip: (req) => !hasEmail(req),
  message: {
    success: false,
    message: "Too many reset requests for this account. Please wait 15 minutes and try again.",
  },
});

const resetPasswordAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: emailKey,
  skip: (req) => !hasEmail(req),
  message: {
    success: false,
    message: "Too many attempts for this account. Please wait 15 minutes and try again.",
  },
});

router.post("/login",  loginLimiter, login);
router.post("/logout", logout);
router.get("/me",      authenticate, getMe);
router.post("/forgot-password", forgotPasswordLimiter, forgotPasswordAccountLimiter, forgotPassword);
router.post("/reset-password",  resetPasswordLimiter,  resetPasswordAccountLimiter,  resetPassword);

export default router;

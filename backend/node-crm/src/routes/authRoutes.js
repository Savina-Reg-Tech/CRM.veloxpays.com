import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, logout, getMe } from "../controllers/authController.js";
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

router.post("/login",  loginLimiter, login);
router.post("/logout", logout);
router.get("/me",      authenticate, getMe);

export default router;

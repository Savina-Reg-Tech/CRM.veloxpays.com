import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import approvalRoutes from "./routes/approvalRoutes.js";
import verificationRoutes from "./routes/verificationRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import veloxEsimRoutes from "./routes/veloxEsimRoutes.js";
import formRoutes from "./routes/formRoutes.js";
import publicFormRoutes from "./routes/publicFormRoutes.js";
import veloxverseProxy from "./middleware/veloxverseProxy.js";
import { AUDIT_SUPPORT_ROLE, auditSupportGuard } from "./middleware/auditSupportGuard.js";
import { authenticate, authorizeRoles } from "./middleware/auth.js";

const app = express();
const isProduction = process.env.NODE_ENV === "production";

// Behind nginx/load balancers — needed so req.ip reflects the real client
// address for the verification audit log.
app.set("trust proxy", true);

// ── Security headers (must come BEFORE routes) ──────────────────────────────
// Helmet sets sensible defaults for X-Content-Type-Options, X-Frame-Options,
// Strict-Transport-Security, Referrer-Policy, etc. We disable the default
// crossOriginResourcePolicy because the frontend lives on a different origin
// during local development (localhost:3001 vs localhost:5001).
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // API only, no HTML served from here
  })
);

// ── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3001")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow same-origin/server-to-server tools without an Origin header.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  // The VeloxVerse audit-log CSV export reports its filename/row count in headers; a
  // cross-origin frontend can only read them if they're exposed.
  exposedHeaders: ["Content-Disposition", "X-Export-Rows", "X-Export-Truncated", "X-Request-Id"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ── Body Parsers ────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Root Route ────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Health Check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── API Routes ──────────────────────────────────────────────────────────────
app.use("/api/auth",  authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/velox-esim", veloxEsimRoutes);
app.use("/api/forms", formRoutes);

// ── VeloxVerse customer-journey audit log — support access (Phase 2) ─
// Support staff may READ the audit log (VeloxVerse masks customer PII for them) and
// nothing else on VeloxVerse. Mounted before the general proxy so this narrower rule
// decides for /admin/audit; admins pass straight through to the same proxy.
app.use(
  "/api/vv-admin/admin/audit",
  authenticate,
  authorizeRoles("super_admin", "admin", AUDIT_SUPPORT_ROLE),
  auditSupportGuard,
  (req, _res, next) => {
    // veloxverseProxy builds the upstream URL from req.url; restore the mount path.
    req.url = `/admin/audit${req.url}`;
    next();
  },
  veloxverseProxy
);

// ── VeloxVerse Admin Proxy ─────────────────────────────────────────
// Proxies admin API calls to the VeloxVerse backend. Only super_admin
// and admin roles can access these endpoints.
app.use(
  "/api/vv-admin",
  authenticate,
  authorizeRoles("super_admin", "admin"),
  veloxverseProxy
);

// ── Public routes (no auth, wider CORS for embed) ────────────────
// Allow any origin for public form endpoints so external websites can embed forms
app.use("/public", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
}, publicFormRoutes);
app.get("/form.js", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
}, (req, res, next) => {
  // delegate to the public router handler
  req.url = "/form.js";
  publicFormRoutes(req, res, next);
});

// ── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ── Global Error Handler ─────────────────────────────────────────────────────
// In production, never leak internal error details for unhandled 5xx errors.
// Application-thrown errors that carry a 4xx status are user-facing and safe
// to surface verbatim (e.g. validation failures).
app.use((err, _req, res, _next) => {
  console.error("Unhandled Error:", err.stack || err);
  const status = err.status || 500;
  const isClientError = status >= 400 && status < 500;
  const safeToShow = !isProduction || isClientError;
  res.status(status).json({
    success: false,
    message: safeToShow
      ? err.message || "Internal Server Error"
      : "Internal Server Error",
  });
});

export default app;

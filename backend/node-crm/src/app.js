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
import { storageStatus } from "./storage/index.js";
import { query } from "../config/db.js";

/** @param {string | undefined} raw */
export function parseTrustProxy(raw) {
  const value = (raw ?? "").trim();
  if (value === "") return 1;
  if (/^\d+$/.test(value)) return Number(value);
  if (value.toLowerCase() === "false") return false;
  // "true" would trust every hop, i.e. the client's own header — never allow it.
  if (value.toLowerCase() === "true") return 1;
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}

const app = express();
const isProduction = process.env.NODE_ENV === "production";

// Behind a load balancer req.ip must be the real client address — the rate limiters and the
// verification audit log both key on it. Trust only the proxies we actually run: with
// `true`, Express takes the client-supplied X-Forwarded-For at face value and every per-IP
// limit (login, password-reset codes, public forms) can be bypassed by rotating that header.
// TRUST_PROXY = number of proxy hops in front of this API (default 1), or a comma-separated
// list of proxy addresses / subnets. Use 0 when the API is reached directly.
app.set("trust proxy", parseTrustProxy(process.env.TRUST_PROXY));

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
    // Refused outright (not just "no CORS headers") — with cookie auth this is also what stops
    // another site from driving the CRM API. A 403, not a 500 with a stack trace.
    return callback(Object.assign(new Error("Origin not allowed"), { status: 403 }));
  },
  credentials: true,
  // The VeloxVerse audit-log CSV export reports its filename/row count in headers; a
  // cross-origin frontend can only read them if they're exposed.
  exposedHeaders: ["Content-Disposition", "X-Export-Rows", "X-Export-Truncated", "X-Request-Id"],
};

// Public form endpoints are embedded on other people's websites, so they answer any origin —
// without credentials. They must be matched BEFORE the CRM allowlist above gets a say, or every
// embed on a third-party site is refused (it used to surface as a 500).
const publicCors = cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"], allowedHeaders: ["Content-Type"] });
const crmCors = cors(corsOptions);
export const isPublicPath = (path) => path === "/form.js" || path === "/public" || path.startsWith("/public/");

app.use((req, res, next) => (isPublicPath(req.path) ? publicCors : crmCors)(req, res, next));

// ── Body Parsers ────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Root Route ────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Health Check ────────────────────────────────────────────────────────────
// Liveness: is the process up? Lightsail's health check uses this, so it deliberately does not
// touch the database — a short DB blip must not make Lightsail recycle a healthy container.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Readiness: can this instance actually serve requests? For uptime monitoring.
app.get("/ready", async (_req, res) => {
  try {
    await query("SELECT 1");
    res.json({ status: "ok", database: "ok", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "unavailable", database: "unreachable", timestamp: new Date().toISOString() });
  }
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

// Where uploaded documents are stored and whether that storage is reachable — shown on the CRM
// Settings page. Names the bucket and region only; never credentials.
app.get("/api/storage/status", authenticate, authorizeRoles("super_admin", "admin"), async (_req, res) => {
  res.json({ success: true, message: "Storage status", data: await storageStatus() });
});

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
// CORS for these paths is handled at the top of the file (publicCors).
app.use("/public", publicFormRoutes);
app.get("/form.js", (req, res, next) => {
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
  const status = err.status || 500;
  // Expected refusals (4xx) are not worth a stack trace in the logs.
  if (status >= 500) console.error("Unhandled Error:", err.stack || err);
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

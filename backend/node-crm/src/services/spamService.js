import { promises as dns } from "dns";
import { createRequire } from "module";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import BlockedEmailDomain from "../models/BlockedEmailDomain.js";

// disposable-email-domains npm package (loaded via createRequire for ESM compat)
const require = createRequire(import.meta.url);
const disposableDomainsList = require("disposable-email-domains");

// Also load the authoritative GitHub blocklist if it was downloaded during build.
// This file covers domains the npm package misses (e.g. adroh.com).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOCKLIST_PATH = path.resolve(__dirname, "../../../data/disposable_email_blocklist.conf");
let confDomains = [];
if (existsSync(BLOCKLIST_PATH)) {
  const raw = readFileSync(BLOCKLIST_PATH, "utf8");
  confDomains = raw.split("\n")
    .map(l => l.trim().toLowerCase())
    .filter(l => l && !l.startsWith("#"));
  console.log(`[spamService] Loaded ${confDomains.length} domains from GitHub blocklist`);
} else {
  console.log("[spamService] GitHub blocklist not found — using npm package only");
}

/**
 * Spam scoring engine.
 *
 * Score thresholds:
 *   0  – 30  → NEW    (normal lead)
 *   31 – 60  → REVIEW (suspicious)
 *   61+      → SPAM
 *
 * Point rules:
 *   Submitted in < 3 s                : +30  (bot speed)
 *   Submitted in 3–5 s                : +10  (suspicious but possible)
 *   Admin-blocked email domain        : +100 (explicit block → always SPAM)
 *   Known disposable email service    : +70  (very likely fake)
 *   Email domain has no MX records    : +50  (undeliverable — probably fake)
 */

// ── Score thresholds ─────────────────────────────────────────────
const THRESHOLDS = { REVIEW: 31, SPAM: 61 };

// ── Merged disposable domain set ─────────────────────────────────
// Sources (all merged for maximum coverage):
//   1. npm package  — 121,000+ domains (broad coverage)
//   2. GitHub conf  — authoritative list, downloaded fresh during Docker build
//   3. Supplemental — hand-picked domains known to slip through both
const SUPPLEMENTAL_DISPOSABLE = [
  "tempmail.com","tempmail.net","tempmail.org","tempmail.de","tempmail.us",
  "temp-mail.io","temp-mail.de","temp-mail.ru",
  "discard.email","getairmail.com","filzmail.com","tempmailaddress.com",
  "emailondeck.com","mohmal.com","inboxbear.com","mintemail.com",
  "throwam.com","throam.com","spamgob.com","airmail.in",
  "trashmail.at","trashmail.xyz",
];

const DISPOSABLE_DOMAINS = new Set([
  ...(Array.isArray(disposableDomainsList) ? disposableDomainsList : []),
  ...confDomains,
  ...SUPPLEMENTAL_DISPOSABLE,
]);
console.log(`[spamService] Disposable domain set: ${DISPOSABLE_DOMAINS.size} total (npm + GitHub conf + supplemental)`);

// ── MX record cache (in-memory, 24h TTL) ─────────────────────────
const mxCache = new Map(); // domain → { hasMx: boolean, expiresAt: number }
const MX_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MX_TIMEOUT   = 4000; // 4 seconds max per lookup

/**
 * Check whether a domain has MX records (i.e. can receive email).
 * Results are cached for 24 hours to avoid hammering DNS on repeat submissions.
 * On timeout or DNS error, defaults to "no MX" (conservative / flags as suspicious).
 */
async function hasMxRecords(domain) {
  const now = Date.now();
  const cached = mxCache.get(domain);
  if (cached && cached.expiresAt > now) return cached.hasMx;

  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("mx_timeout")), MX_TIMEOUT)
      ),
    ]);
    const hasMx = Array.isArray(records) && records.length > 0;
    mxCache.set(domain, { hasMx, expiresAt: now + MX_CACHE_TTL });
    return hasMx;
  } catch {
    // DNS error or timeout — treat as no MX
    mxCache.set(domain, { hasMx: false, expiresAt: now + MX_CACHE_TTL });
    return false;
  }
}

// ── Domain extractor ─────────────────────────────────────────────
function extractDomain(email) {
  if (!email || !email.includes("@")) return null;
  return email.split("@")[1].toLowerCase().trim();
}

// ── Main scoring function ─────────────────────────────────────────
/**
 * @param {{ email: string|null, timeTakenSeconds: number|null }} opts
 * @returns {Promise<{ score: number, status: string, flags: string[] }>}
 */
async function calculateSpamScore({ email, timeTakenSeconds }) {
  let score = 0;
  const flags = [];

  // ── Time-based checks ────────────────────────────────────────
  if (timeTakenSeconds != null) {
    if (timeTakenSeconds < 3) {
      score += 30;
      flags.push("submitted_too_fast");
    } else if (timeTakenSeconds <= 5) {
      score += 10;
      flags.push("submitted_fast");
    }
  }

  // ── Email domain checks ──────────────────────────────────────
  if (email) {
    const domain = extractDomain(email);
    if (domain) {
      // 1. Admin-blocked domain (highest priority — explicit block)
      const blocked = await BlockedEmailDomain.isBlocked(domain);
      if (blocked) {
        score += 100;
        flags.push("blocked_email_domain");
      }

      // 2. Known disposable / throwaway email service
      if (!blocked && DISPOSABLE_DOMAINS.has(domain)) {
        score += 70;
        flags.push("disposable_email");
      }

      // 3. MX record check — does this domain actually accept email?
      // Skip for domains already caught above to save DNS calls.
      if (!blocked && !DISPOSABLE_DOMAINS.has(domain)) {
        const mx = await hasMxRecords(domain);
        if (!mx) {
          score += 50;
          flags.push("no_mx_records");
        }
      }
    }
  }

  // ── Derive status ─────────────────────────────────────────────
  const status =
    score >= THRESHOLDS.SPAM   ? "SPAM"   :
    score >= THRESHOLDS.REVIEW ? "REVIEW" :
    "NEW";

  console.log(`[spamService] email=${email} domain=${extractDomain(email)} score=${score} status=${status} flags=${flags.join(",") || "none"}`);

  return { score, status, flags };
}

/**
 * Validate a single email address.
 * Used by the public /validate-email endpoint AND inside processFormSubmission.
 *
 * @param {string} email
 * @returns {Promise<{ valid: boolean, reason?: string }>}
 */
async function validateEmail(email) {
  if (!email || typeof email !== "string") {
    return { valid: false, reason: "Email address is required." };
  }

  const trimmed = email.trim().toLowerCase();

  // ── Format check ───────────────────────────────────────────────
  // Must have exactly one @, non-empty local part, domain with a dot
  const FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!FORMAT_RE.test(trimmed)) {
    return { valid: false, reason: "Please enter a valid email address." };
  }

  const domain = extractDomain(trimmed);
  if (!domain || !domain.includes(".")) {
    return { valid: false, reason: "Please enter a valid email address." };
  }

  // ── Disposable email ───────────────────────────────────────────
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      valid: false,
      reason: "Temporary/disposable email addresses are not accepted. Please use your real email.",
    };
  }

  // ── MX record check ────────────────────────────────────────────
  const mx = await hasMxRecords(domain);
  if (!mx) {
    return {
      valid: false,
      reason: `"${domain}" doesn't appear to be a valid email domain. Please double-check your address.`,
    };
  }

  return { valid: true };
}

export { calculateSpamScore, validateEmail, extractDomain };

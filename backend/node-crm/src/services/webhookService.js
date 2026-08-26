import http from "node:http";
import https from "node:https";
import crypto from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";

/**
 * Conditional "webhook" action sender — POSTs submission data to an
 * admin-configured URL when a WebhookRule's WHEN-conditions match.
 *
 * This is the one action in the rule engine that reaches out to a
 * user-supplied URL from OUR server, which makes it the one place in this
 * feature with real SSRF exposure: a malicious or careless admin (or an
 * admin account taken over by an attacker) could otherwise point a webhook
 * at http://169.254.169.254/ (cloud metadata), http://localhost:5432, or
 * an internal-only service and use the CRM server as a proxy to reach it.
 * Everything below exists to close that off.
 */

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 64 * 1024; // don't buffer unbounded attacker-controlled response bodies

// ── SSRF guard: block loopback / private / link-local / metadata ranges ──

function isBlockedIPv4(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true; // malformed → block
  const [a, b] = parts;
  if (a === 0) return true;                          // 0.0.0.0/8 "this network"
  if (a === 10) return true;                          // 10.0.0.0/8 private
  if (a === 127) return true;                         // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true;             // 169.254.0.0/16 link-local (incl. 169.254.169.254 cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true;     // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true;              // 192.168.0.0/16 private
  if (a === 192 && b === 0 && parts[2] === 2) return true; // 192.0.2.0/24 TEST-NET
  if (a === 100 && b >= 64 && b <= 127) return true;    // 100.64.0.0/10 carrier-grade NAT (also used by some cloud metadata setups)
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
  if (a >= 224) return true;                            // 224.0.0.0+ multicast/reserved/broadcast
  return false;
}

function isBlockedIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::" || lower === "::0") return true; // loopback / unspecified
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true; // fe80::/10 link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;     // fc00::/7 unique local (private)
  if (lower.startsWith("::ffff:")) {
    const mapped = lower.split(":").pop();
    return mapped ? isBlockedIPv4(mapped) : true;
  }
  return false;
}

function isBlockedIp(address, family) {
  if (family === 6 || address.includes(":")) return isBlockedIPv6(address);
  return isBlockedIPv4(address);
}

/**
 * Validate a webhook URL is even worth attempting: http(s) only, resolvable
 * hostname. This is a cheap upfront check for save-time validation (see
 * ruleEngine.js) — it is NOT sufficient on its own to prevent SSRF, since a
 * hostname can resolve to a safe IP now and a private one later (DNS
 * rebinding). The real enforcement is the custom `lookup` wired into the
 * actual request in `sendWebhook` below, which validates the exact IP it is
 * about to connect to.
 */
function isPlausibleWebhookUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * POST `payload` as JSON to `url`, signing the body with HMAC-SHA256 (if a
 * secret is configured) so the receiver can verify the request actually
 * came from us. Every attempt — success or failure — should be logged by
 * the caller via WebhookDelivery; this function never throws, it always
 * resolves with a result object.
 */
async function sendWebhook({ url, payload, secret, timeoutMs = DEFAULT_TIMEOUT_MS, maxResponseBytes = MAX_RESPONSE_BYTES }) {
  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { success: false, error: "Invalid webhook URL", statusCode: null, durationMs: elapsed() };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { success: false, error: "Only http/https webhook URLs are allowed", statusCode: null, durationMs: elapsed() };
  }

  const body = JSON.stringify(payload);
  const signature = secret
    ? "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex")
    : undefined;

  const transport = parsed.protocol === "https:" ? https : http;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve({ statusCode: null, error: null, ...result, durationMs: elapsed() });
    };

    let req;
    try {
      req = transport.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
          path: `${parsed.pathname}${parsed.search}`,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
            "User-Agent": "Velox-CRM-Webhook/1.0",
            "X-Velox-Event": "form.submission",
            ...(signature ? { "X-Velox-Signature": signature } : {}),
          },
          timeout: timeoutMs,
          // Resolve DNS ourselves and hand Node the exact validated IP to
          // connect to — validating a separately-resolved IP and then
          // letting Node re-resolve the hostname itself would leave a gap
          // for DNS rebinding (safe IP at check time, private IP at
          // connect time). Doing both in this one callback closes that.
          lookup: (hostname, options, callback) => {
            dnsLookup(hostname, { all: true, verbatim: true })
              .then((addresses) => {
                const safe = addresses.find((a) => !isBlockedIp(a.address, a.family));
                if (!safe) {
                  callback(new Error("Refusing to call an internal/private/link-local address"));
                  return;
                }
                callback(null, safe.address, safe.family);
              })
              .catch((err) => callback(err));
          },
        },
        (res) => {
          let received = 0;
          const chunks = [];
          res.on("data", (chunk) => {
            received += chunk.length;
            if (received > maxResponseBytes) {
              req.destroy(new Error("Webhook response exceeded size limit"));
              return;
            }
            chunks.push(chunk);
          });
          res.on("end", () => {
            const ok = (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300;
            finish({ success: ok, statusCode: res.statusCode, error: ok ? null : `Receiver returned HTTP ${res.statusCode}` });
          });
        }
      );
    } catch (err) {
      finish({ success: false, error: err.message });
      return;
    }

    req.on("timeout", () => req.destroy(new Error(`Webhook request timed out after ${timeoutMs}ms`)));
    req.on("error", (err) => finish({ success: false, error: err.message }));

    req.write(body);
    req.end();
  });
}

export { sendWebhook, isPlausibleWebhookUrl, isBlockedIp };

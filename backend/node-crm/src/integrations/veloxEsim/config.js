/**
 * Velox eSIM external service configuration.
 * CRM port 5001 proxies to Velox eSIM API (default port 5000).
 */

/** Roles allowed to view Velox eSIM customer data (v1). */
export const VELOX_ESIM_VIEW_ROLES = Object.freeze(["super_admin", "admin"]);

/**
 * @returns {{ baseUrl: string; apiKey: string }}
 */
export function getVeloxEsimConfig() {
  const baseUrl = (process.env.VELOX_API_URL || "http://localhost:5000").replace(/\/$/, "");
  const apiKey = process.env.VELOX_API_KEY?.trim() || "";
  return { baseUrl, apiKey };
}

/**
 * @returns {boolean}
 */
export function isVeloxEsimConfigured() {
  const { apiKey } = getVeloxEsimConfig();
  return apiKey.length > 0;
}

/**
 * @throws {{ status: number; message: string }}
 */
export function assertVeloxEsimConfigured() {
  if (!isVeloxEsimConfigured()) {
    throw {
      status: 503,
      message:
        "Velox eSIM integration is not configured. Set VELOX_API_URL and VELOX_API_KEY on the CRM backend.",
    };
  }
}

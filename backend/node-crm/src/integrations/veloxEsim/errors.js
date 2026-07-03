/**
 * Normalize Velox eSIM HTTP / JSON errors into CRM-friendly throw objects.
 */

/**
 * @param {unknown} err
 * @returns {{ status: number; message: string }}
 */
export function toVeloxEsimServiceError(err) {
  if (err && typeof err === "object" && "status" in err && "message" in err) {
    return {
      status: Number(err.status) || 500,
      message: String(err.message),
    };
  }

  if (err instanceof Error) {
    if (err.cause?.code === "ECONNREFUSED" || err.message.includes("fetch failed")) {
      return {
        status: 503,
        message:
          "Cannot reach the Velox eSIM API. Ensure it is running and VELOX_API_URL is correct.",
      };
    }
    return { status: 502, message: err.message || "Velox eSIM request failed" };
  }

  return { status: 500, message: "Velox eSIM request failed" };
}

/**
 * @param {number} status
 * @param {unknown} body
 * @returns {{ status: number; message: string }}
 */
export function veloxHttpError(status, body) {
  const message =
    body && typeof body === "object" && "message" in body && body.message
      ? String(body.message)
      : `Velox eSIM API returned HTTP ${status}`;

  if (status === 401) {
    return { status: 502, message: "Velox eSIM API rejected the CRM API key" };
  }
  if (status === 404) {
    return { status: 404, message: "Customer not found on Velox eSIM platform" };
  }
  if (status >= 500) {
    return { status: 503, message: message };
  }
  return { status: status >= 400 && status < 500 ? status : 502, message };
}

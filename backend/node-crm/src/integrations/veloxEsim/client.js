import { assertVeloxEsimConfigured, getVeloxEsimConfig } from "./config.js";
import { toVeloxEsimServiceError, veloxHttpError } from "./errors.js";
import {
  mapVeloxCustomerDetailResponse,
  mapVeloxCustomerListResponse,
} from "./mappers.js";

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * @param {string} path — e.g. `/api/crm/customers`
 * @param {{ searchParams?: Record<string, string | number | undefined> }} [opts]
 * @returns {Promise<unknown>}
 */
async function veloxFetch(path, { searchParams } = {}) {
  assertVeloxEsimConfigured();
  const { baseUrl, apiKey } = getVeloxEsimConfig();

  const url = new URL(path, `${baseUrl}/`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
      },
      signal: controller.signal,
    });

    let body = null;
    const text = await res.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        throw { status: 502, message: "Velox eSIM API returned non-JSON response" };
      }
    }

    if (!res.ok) {
      throw veloxHttpError(res.status, body);
    }

    if (body && typeof body === "object" && body.success === false) {
      throw veloxHttpError(502, body);
    }

    return body;
  } catch (err) {
    if (err?.name === "AbortError") {
      throw { status: 504, message: "Velox eSIM API request timed out" };
    }
    throw toVeloxEsimServiceError(err);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * @param {{ page?: number; limit?: number; search?: string }} [params]
 */
export async function fetchVeloxCustomers(params = {}) {
  const envelope = await veloxFetch("/api/crm/customers", {
    searchParams: {
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      search: params.search,
    },
  });
  return mapVeloxCustomerListResponse(envelope);
}

/**
 * @param {string} customerId
 */
export async function fetchVeloxCustomerById(customerId) {
  const id = typeof customerId === "string" ? customerId.trim() : "";
  if (!id) {
    throw { status: 400, message: "Customer id is required" };
  }
  const envelope = await veloxFetch(`/api/crm/customers/${encodeURIComponent(id)}`);
  return mapVeloxCustomerDetailResponse(envelope);
}

/**
 * Lightweight connectivity probe (VELOX-0).
 */
export async function pingVeloxEsimApi() {
  if (!getVeloxEsimConfig().apiKey) {
    return { configured: false, reachable: false, message: "VELOX_API_KEY is not set" };
  }
  try {
    await veloxFetch("/api/crm/customers", { searchParams: { limit: 1, page: 1 } });
    return { configured: true, reachable: true, message: "Connected to Velox eSIM API" };
  } catch (err) {
    const normalized = toVeloxEsimServiceError(err);
    return {
      configured: true,
      reachable: false,
      message: normalized.message,
    };
  }
}

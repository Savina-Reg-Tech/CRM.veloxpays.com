import { getVeloxEsimConfig, isVeloxEsimConfigured } from "../integrations/veloxEsim/config.js";
import {
  fetchVeloxCustomerById,
  fetchVeloxCustomers,
  pingVeloxEsimApi,
} from "../integrations/veloxEsim/client.js";

/**
 * @param {{ page?: number; limit?: number; search?: string }} opts
 */
export const listVeloxEsimCustomers = async (opts = {}) => {
  const page = Math.max(Number(opts.page) || 1, 1);
  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 100);
  const search = typeof opts.search === "string" ? opts.search.trim() : "";

  const { customers, pagination } = await fetchVeloxCustomers({
    page,
    limit,
    search: search || undefined,
  });

  return { customers, pagination };
};

/**
 * @param {string} id — Velox platform customer id (string cuid)
 */
export const getVeloxEsimCustomerById = async (id) => {
  const { customer } = await fetchVeloxCustomerById(id);
  return customer;
};

/** Connection status for admin diagnostics (VELOX-0). */
export const getVeloxEsimIntegrationHealth = async () => {
  const { baseUrl } = getVeloxEsimConfig();
  const configured = isVeloxEsimConfigured();
  if (!configured) {
    return {
      configured: false,
      reachable: false,
      veloxApiUrl: baseUrl,
      message: "VELOX_API_KEY is not set on the CRM backend",
    };
  }
  const ping = await pingVeloxEsimApi();
  return {
    ...ping,
    veloxApiUrl: baseUrl,
  };
};

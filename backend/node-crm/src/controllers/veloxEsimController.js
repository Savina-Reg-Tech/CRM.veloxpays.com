import {
  getVeloxEsimCustomerById,
  getVeloxEsimIntegrationHealth,
  listVeloxEsimCustomers,
} from "../services/veloxEsimService.js";
import { sendError, sendSuccess } from "../utils/response.js";

export const handleVeloxEsimHealth = async (_req, res) => {
  try {
    const status = await getVeloxEsimIntegrationHealth();
    return sendSuccess(res, status, "Velox eSIM integration status");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleListVeloxEsimCustomers = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.limit, 10);
    const search = typeof req.query.search === "string" ? req.query.search : "";

    const result = await listVeloxEsimCustomers({
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 50,
      search,
    });
    return sendSuccess(res, result, "Velox eSIM customers retrieved");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleGetVeloxEsimCustomerById = async (req, res) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!id) {
      return sendError(res, "Invalid customer id", 400);
    }
    const customer = await getVeloxEsimCustomerById(id);
    return sendSuccess(res, { customer }, "Velox eSIM customer retrieved");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

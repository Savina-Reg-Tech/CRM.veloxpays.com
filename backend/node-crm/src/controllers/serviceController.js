import { listServiceCatalog } from "../services/serviceCatalogService.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const handleListServices = async (req, res) => {
  try {
    const includeDisabled = String(req.query.includeDisabled ?? "")
      .toLowerCase()
      .trim() === "true";
    const services = await listServiceCatalog({ includeDisabled });
    return sendSuccess(res, services, "Services fetched successfully");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

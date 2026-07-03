import {
  createCustomer,
  deleteCustomer,
  getCustomerDetails,
  listCustomers,
  updateCustomer,
  CUSTOMER_SOURCES,
  CUSTOMER_STATUSES,
} from "../services/customerService.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const handleListCustomerSources = async (_req, res) => {
  return sendSuccess(res, CUSTOMER_SOURCES, "Customer sources fetched");
};

export const handleListCustomerStatuses = async (_req, res) => {
  return sendSuccess(res, CUSTOMER_STATUSES, "Customer statuses fetched");
};

export const handleCreateCustomer = async (req, res) => {
  try {
    const customer = await createCustomer(req.body, req.user);
    return sendSuccess(res, customer, "Customer created successfully", 201);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

// Sanitize pagination query params. Defaults are pageSize=20, max=100 so a
// rogue or misbehaving client can never demand the entire table.
const parsePagination = (req) => {
  const rawLimit = parseInt(req.query.limit, 10);
  const rawOffset = parseInt(req.query.offset, 10);
  const limit = Math.min(
    Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1),
    100
  );
  const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
  return { limit, offset };
};

export const handleListCustomers = async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req);
    const result = await listCustomers(req.user, { limit, offset });
    return sendSuccess(res, result, "Customers fetched successfully");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleGetCustomerById = async (req, res) => {
  try {
    const customer = await getCustomerDetails(req.params.id, req.user);
    return sendSuccess(res, customer, "Customer fetched successfully");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleUpdateCustomer = async (req, res) => {
  try {
    const updated = await updateCustomer(req.params.id, req.body, req.user);
    return sendSuccess(res, updated, "Customer updated successfully");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleDeleteCustomer = async (req, res) => {
  try {
    const result = await deleteCustomer(req.params.id, req.user);
    return sendSuccess(res, result, "Customer deleted successfully");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

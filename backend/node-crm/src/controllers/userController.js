import {
  createUser,
  getAllUsers,
  getUserStats,
  toggleUserStatus,
  resetUserPassword,
} from "../services/userService.js";
import { sendSuccess, sendError } from "../utils/response.js";

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

/**
 * POST /api/users
 * Super Admin/Admin/Employee — create users based on role hierarchy
 */
export const handleCreateUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return sendError(res, "Name, email, password and role are required", 400);
    }

    const user = await createUser({ name, email, password, role }, req.user);
    return sendSuccess(res, user, "User created successfully", 201);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

/**
 * POST /api/users/employees
 * Backward-compatible endpoint for creating employee users.
 */
export const handleCreateEmployee = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return sendError(res, "Name, email and password are required", 400);
    }

    const user = await createUser({ name, email, password, role: "employee" }, req.user);
    return sendSuccess(res, user, "Employee created successfully", 201);
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

/**
 * GET /api/users — list CRM users (paginated)
 *
 * Query params: limit (1..100, default 20), offset (default 0).
 * Response data shape: { items, total, limit, offset }
 */
export const handleGetUsers = async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req);
    const result = await getAllUsers({ limit, offset });
    return sendSuccess(res, result, "Users fetched successfully");
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * GET /api/users/stats — aggregate counts for dashboard cards.
 */
export const handleGetUserStats = async (_req, res) => {
  try {
    const stats = await getUserStats();
    return sendSuccess(res, stats, "User stats fetched");
  } catch (err) {
    return sendError(res, err.message, 500);
  }
};

/**
 * PATCH /api/users/:id/toggle-status
 * Super Admin only — activate or deactivate a user
 */
export const handleToggleStatus = async (req, res) => {
  try {
    const result = await toggleUserStatus(req.params.id, req.user.id);
    return sendSuccess(res, result, "User status updated");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

/**
 * POST /api/users/:id/reset-password
 * Super Admin/Admin — reset another user's password. Role hierarchy is
 * enforced in the service (mirrors who each role is allowed to create).
 * Body: { password?: string } — omit to auto-generate a strong password,
 * which is returned once in the response for the admin to hand off.
 */
export const handleResetPassword = async (req, res) => {
  try {
    const { password } = req.body || {};
    const result = await resetUserPassword({ userId: req.params.id, password }, req.user);
    return sendSuccess(res, result, "Password reset successfully");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

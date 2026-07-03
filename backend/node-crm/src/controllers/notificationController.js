import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../services/notificationService.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const handleListNotifications = async (req, res) => {
  try {
    const rawLimit = parseInt(req.query.limit, 10);
    const rawOffset = parseInt(req.query.offset, 10);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 20, 1), 100);
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
    const items = await listNotifications(req.user.id, { limit, offset });
    return sendSuccess(res, items, "Notifications");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleUnreadCount = async (req, res) => {
  try {
    const count = await getUnreadCount(req.user.id);
    return sendSuccess(res, { count }, "Unread notifications count");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleMarkRead = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return sendError(res, "Invalid id", 400);
    const updated = await markNotificationRead(req.user.id, id);
    if (!updated) return sendError(res, "Notification not found", 404);
    return sendSuccess(res, updated, "Notification marked read");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

export const handleMarkAllRead = async (req, res) => {
  try {
    const count = await markAllNotificationsRead(req.user.id);
    return sendSuccess(res, { count }, "All notifications marked read");
  } catch (err) {
    return sendError(res, err.message, err.status || 500);
  }
};

/**
 * Notification fan-out: writes an in-app notification row and (best-effort)
 * sends an email for the same event. Used across verification, activation,
 * and the expiry worker.
 *
 * Spec events: document_uploaded, document_approved, document_rejected,
 * reupload_required, account_activated, account_expiring_24h, account_expired.
 */
import Notification from "../models/Notification.js";
import { sendMail } from "../utils/mailer.js";

export const NOTIFICATION_EVENTS = Object.freeze([
  "document_uploaded",
  "document_approved",
  "document_rejected",
  "reupload_required",
  "account_activated",
  "account_expiring_24h",
  "account_expired",
]);

/**
 * Persist an in-app notification and optionally email it.
 *
 * @param {object} args
 * @param {object} [args.client]            optional transaction client for the DB row
 * @param {{ id: number; email?: string }} args.recipient
 * @param {string} args.event
 * @param {string} args.title
 * @param {string} [args.body]
 * @param {object} [args.metadata]
 * @param {boolean} [args.email=true]       also send an email
 */
export const notify = async ({
  client,
  recipient,
  event,
  title,
  body,
  metadata,
  email = true,
}) => {
  if (!recipient?.id) return null;

  const row = await Notification.insert(client, {
    userId: recipient.id,
    event,
    title,
    body,
    metadata,
  });

  if (email && recipient.email) {
    // Fire-and-forget — sendMail swallows its own errors.
    void sendMail({
      to: recipient.email,
      subject: title,
      text: body || title,
    });
  }

  return row;
};

export const listNotifications = (userId, opts) =>
  Notification.listForUser(userId, opts);

export const getUnreadCount = (userId) => Notification.unreadCount(userId);

export const markNotificationRead = (userId, id) =>
  Notification.markRead(userId, id);

export const markAllNotificationsRead = (userId) =>
  Notification.markAllRead(userId);

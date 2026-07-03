import bcrypt from "bcrypt";
import User from "../models/User.js";
import { getClient } from "../../config/db.js";
import { ALLOWED_ROLES, ROLE_CREATION_MATRIX } from "../config/crmRoles.js";
import { validatePassword } from "../utils/passwordPolicy.js";
import { insertUserOnboardingApprovalInTransaction } from "./approvalService.js";
import {
  roleRequiresVerification,
  VERIFICATION_WINDOW_DAYS,
} from "../config/verificationDocs.js";

/**
 * Creates a new CRM user account with role hierarchy checks.
 * When the new role requires onboarding approval, a user_onboarding ticket
 * is created in the same transaction so moderators see it immediately.
 */
export const createUser = async ({ name, email, password, role }, creator) => {
  const targetRole = role?.trim?.();
  if (!targetRole || !ALLOWED_ROLES.includes(targetRole)) {
    throw { status: 400, message: "Invalid role provided" };
  }

  const creatorRole = creator?.role;
  const creatableRoles = ROLE_CREATION_MATRIX[creatorRole] || [];
  if (!creatableRoles.includes(targetRole)) {
    throw {
      status: 403,
      message: `Role '${creatorRole}' is not allowed to create '${targetRole}' users`,
    };
  }

  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail) {
    throw { status: 400, message: "Email is required" };
  }

  const pwdCheck = validatePassword(password);
  if (!pwdCheck.valid) {
    throw { status: 400, message: pwdCheck.message };
  }

  const existing = await User.findByEmail(normalizedEmail);
  if (existing) {
    throw { status: 409, message: "An account with this email already exists" };
  }

  const hashedPassword = await bcrypt.hash(password.trim(), 10);

  const client = await getClient();
  try {
    await client.query("BEGIN");

    // Per spec: every new account can log in immediately, but verification roles
    // (employee/agent/affiliate) start as 'pending' with a 7-day window and must
    // complete document verification before activation. Admins are auto-active.
    const needsVerification = roleRequiresVerification(targetRole);
    const accountStatus = needsVerification ? "pending" : "active";
    const verificationDeadline = needsVerification
      ? new Date(Date.now() + VERIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const user = await User.create(
      {
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: targetRole,
        createdBy: creator.id,
        isActive: true,
        accountStatus,
        verificationDeadline,
      },
      { client }
    );

    await insertUserOnboardingApprovalInTransaction(client, creator, user);

    await client.query("COMMIT");
    return user;
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      throw {
        status: 409,
        message: "An open approval request already exists for this user",
      };
    }
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Returns CRM user accounts, newest first, with pagination metadata.
 */
export const getAllUsers = async ({ limit, offset } = {}) => {
  const [items, total] = await Promise.all([
    User.findAllUsers({ limit, offset }),
    User.countAllUsers(),
  ]);
  return { items, total, limit, offset };
};

/**
 * Returns aggregate counts for the user-management dashboard cards.
 * Cheaper and more accurate than paginating + summing client-side.
 */
export const getUserStats = async () => User.getUserStats();

/**
 * Toggles a user's active/inactive status.
 *
 * Refuses to operate when the caller is targeting their own account — a
 * super-admin should not be able to lock themselves out of the system.
 */
export const toggleUserStatus = async (userId, requesterId) => {
  if (requesterId !== undefined && String(userId) === String(requesterId)) {
    throw {
      status: 400,
      message: "You cannot change your own account status",
    };
  }
  const result = await User.toggleActive(userId);
  if (!result) throw { status: 404, message: "User not found" };
  return result;
};

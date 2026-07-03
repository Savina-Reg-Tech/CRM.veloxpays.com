import bcrypt from "bcrypt";
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";

// Single generic message for every failed-login path. Returning different
// messages or status codes for "unknown email", "deactivated", and
// "wrong password" would let an attacker enumerate which emails have
// accounts (OWASP A07: Identification & Authentication Failures).
const INVALID_LOGIN_MESSAGE = "Invalid email or password";

/**
 * Validates credentials and returns a JWT + user info.
 *
 * On any failure (unknown email, deactivated account, wrong password) we
 * throw the same 401 with the same message so an external caller cannot
 * tell the difference between cases.
 */
export const loginUser = async (email, password) => {
  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";

  const user = await User.findByEmail(normalizedEmail, { includePassword: true });

  if (!user || !user.is_active) {
    // Still run bcrypt.compare against a dummy hash so the response time
    // does not differ between "no such user" and "user exists, wrong
    // password". This blunts timing-based enumeration as well.
    await bcrypt.compare(password || "", "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi");
    throw { status: 401, message: INVALID_LOGIN_MESSAGE };
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw { status: 401, message: INVALID_LOGIN_MESSAGE };
  }

  const token = generateToken({ id: user.id, role: user.role });

  return {
    token,
    user: {
      id:    user.id,
      name:  user.name,
      email: user.email,
      role:  user.role,
    },
  };
};

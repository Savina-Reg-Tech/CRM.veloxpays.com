import crypto from "crypto";
import jwt from "jsonwebtoken";

/**
 * Session version: a short fingerprint of the user's current password hash, carried in every
 * session token as `sv`. `authenticate` recomputes it from the database on each request, so
 * changing a password (self-service reset or an admin reset) instantly ends every session issued
 * before — a stolen token stops working. Not reversible: a slice of a SHA-256 of the bcrypt hash.
 *
 * @param {string} passwordHash — users.password
 * @returns {string}
 */
export const sessionVersion = (passwordHash) =>
  crypto.createHash("sha256").update(String(passwordHash)).digest("hex").slice(0, 16);

/**
 * Signs and returns a JWT for the given payload.
 * @param {{ id: number, role: string, sv: string }} payload
 * @returns {string} JWT token
 */
const generateToken = (payload) => {
  // HS256 pinned explicitly: VeloxVerse's CRM bridge only accepts HS256-signed CRM JWTs.
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

export default generateToken;

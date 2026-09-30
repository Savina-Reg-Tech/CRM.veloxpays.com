import jwt from "jsonwebtoken";

/**
 * Signs and returns a JWT for the given payload.
 * @param {{ id: number, role: string }} payload
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

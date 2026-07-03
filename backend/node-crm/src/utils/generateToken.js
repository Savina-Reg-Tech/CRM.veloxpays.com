import jwt from "jsonwebtoken";

/**
 * Signs and returns a JWT for the given payload.
 * @param {{ id: number, role: string }} payload
 * @returns {string} JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

export default generateToken;

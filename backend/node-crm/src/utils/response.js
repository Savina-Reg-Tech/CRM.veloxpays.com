/**
 * Standardized API response helpers.
 * Every endpoint uses these so the JSON shape is always consistent.
 */

export const sendSuccess = (res, data = {}, message = "Success", statusCode = 200) => {
  return res.status(statusCode).json({ success: true, message, data });
};

export const sendError = (res, message = "Something went wrong", statusCode = 500, errors = null) => {
  // A plain 500 is an unexpected failure, and its message is usually a raw database or library
  // error: log it, but don't hand it to the client in production. Deliberate 4xx/502/503
  // messages pass through.
  if (statusCode === 500 && process.env.NODE_ENV === "production") {
    console.error(`❌ 500 ${res.req?.method ?? ""} ${res.req?.originalUrl ?? ""}: ${message}`);
    message = "Something went wrong. Please try again.";
  }
  const payload = { success: false, message };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
};

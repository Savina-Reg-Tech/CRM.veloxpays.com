import Service from "../models/Service.js";

export const SERVICE_ASSIGNMENT_SOURCES = ["manual", "veloxpays-sync"];

export const listServiceCatalog = async ({ includeDisabled = false } = {}) =>
  Service.findAll({ includeDisabled });

/**
 * Validates an array of { code, status?, notes?, source? } and returns
 * normalized rows resolved against the live catalog.
 *
 * Throws { status, message } on any validation problem.
 */
export const resolveAndValidateAssignments = async (
  rawItems,
  { allowSyncSource = false } = {}
) => {
  if (rawItems === undefined || rawItems === null) return null; // means "do not touch"
  if (!Array.isArray(rawItems)) {
    throw { status: 400, message: "services must be an array" };
  }
  if (rawItems.length === 0) return [];

  const requestedCodes = [];
  for (const item of rawItems) {
    if (!item || typeof item !== "object") {
      throw { status: 400, message: "Each service entry must be an object" };
    }
    const code = String(item.code ?? "").trim().toUpperCase();
    if (!code) {
      throw { status: 400, message: "Each service entry requires a code" };
    }
    requestedCodes.push(code);
  }

  const dedupedCodes = [...new Set(requestedCodes)];
  const catalog = await Service.findByCodes(dedupedCodes);
  const catalogByCode = new Map(catalog.map((c) => [c.code, c]));

  const missing = dedupedCodes.filter((c) => !catalogByCode.has(c));
  if (missing.length > 0) {
    throw {
      status: 400,
      message: `Unknown service code(s): ${missing.join(", ")}`,
    };
  }

  const seen = new Set();
  const normalized = [];
  for (const item of rawItems) {
    const code = String(item.code).trim().toUpperCase();
    if (seen.has(code)) continue;
    seen.add(code);

    const cat = catalogByCode.get(code);
    if (!cat.is_enabled) {
      throw { status: 400, message: `Service '${code}' is disabled in the catalog` };
    }

    const status =
      item.status === undefined || item.status === null || item.status === ""
        ? "active"
        : String(item.status).trim().slice(0, 40);
    if (!status) {
      throw { status: 400, message: `status is required for service '${code}'` };
    }

    let source =
      item.source === undefined || item.source === null || item.source === ""
        ? "manual"
        : String(item.source).trim();
    if (!SERVICE_ASSIGNMENT_SOURCES.includes(source)) {
      throw {
        status: 400,
        message: `services[*].source must be one of: ${SERVICE_ASSIGNMENT_SOURCES.join(", ")}`,
      };
    }
    if (!allowSyncSource && source === "veloxpays-sync") {
      source = "manual";
    }

    const notes =
      item.notes === undefined || item.notes === null || item.notes === ""
        ? null
        : String(item.notes).trim().slice(0, 2000) || null;

    normalized.push({
      service_id: cat.id,
      code: cat.code,
      status,
      source,
      notes,
    });
  }

  return normalized;
};

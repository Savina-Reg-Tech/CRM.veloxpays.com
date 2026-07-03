import Customer from "../models/Customer.js";
import CustomerService from "../models/CustomerService.js";
import { resolveAndValidateAssignments } from "./serviceCatalogService.js";

export const CUSTOMER_SOURCES = ["manual", "veloxpays-sync"];

// Closed set of allowed customer lifecycle statuses. Keeping this in one place
// (and exposing it via /api/customers/meta/statuses) means the frontend dropdown
// is always in sync with backend validation.
export const CUSTOMER_STATUSES = [
  "active",
  "inactive",
  "pending",
  "verified",
  "suspended",
  "archived",
];

const PRIVILEGED_VIEW_ROLES = new Set(["super_admin", "admin", "employee"]);

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

const assertSource = (source) => {
  if (!CUSTOMER_SOURCES.includes(source)) {
    throw {
      status: 400,
      message: `source must be one of: ${CUSTOMER_SOURCES.join(", ")}`,
    };
  }
};

const assertStatus = (status) => {
  if (!CUSTOMER_STATUSES.includes(status)) {
    throw {
      status: 400,
      message: `status must be one of: ${CUSTOMER_STATUSES.join(", ")}`,
    };
  }
};

const validatePayload = (body) => {
  const firstName = typeof body.first_name === "string" ? body.first_name.trim() : "";
  const middleName =
    body.middle_name === undefined || body.middle_name === null || body.middle_name === ""
      ? null
      : String(body.middle_name).trim() || null;
  const lastName = typeof body.last_name === "string" ? body.last_name.trim() : "";
  const email = normalizeEmail(body.email);
  const phone =
    body.phone === undefined || body.phone === null || body.phone === ""
      ? null
      : String(body.phone).trim().slice(0, 40) || null;
  const addressLine1 =
    body.address_line1 === undefined || body.address_line1 === null || body.address_line1 === ""
      ? null
      : String(body.address_line1).trim().slice(0, 255) || null;
  const city =
    body.city === undefined || body.city === null || body.city === ""
      ? null
      : String(body.city).trim().slice(0, 120) || null;
  const country =
    body.country === undefined || body.country === null || body.country === ""
      ? null
      : String(body.country).trim().slice(0, 100) || null;
  const statusRaw =
    body.status === undefined || body.status === null
      ? "active"
      : String(body.status).trim();
  const sourceRaw =
    body.source === undefined || body.source === null
      ? "manual"
      : String(body.source).trim();
  const sourceRef =
    body.source_ref === undefined || body.source_ref === null || body.source_ref === ""
      ? null
      : String(body.source_ref).trim().slice(0, 255) || null;

  const dob =
    body.dob === undefined || body.dob === null || body.dob === ""
      ? null
      : String(body.dob).trim().slice(0, 10);

  if (!firstName || !lastName) {
    throw { status: 400, message: "first_name and last_name are required" };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw { status: 400, message: "A valid email is required" };
  }

  assertStatus(statusRaw);
  assertSource(sourceRaw);

  if (sourceRaw === "veloxpays-sync" && !sourceRef) {
    throw { status: 400, message: "source_ref is required when source is veloxpays-sync" };
  }

  return {
    firstName,
    middleName,
    lastName,
    dob,
    email,
    phone,
    addressLine1,
    city,
    country,
    status: statusRaw,
    source: sourceRaw,
    sourceRef,
  };
};

export const createCustomer = async (body, creator) => {
  const normalized = validatePayload(body);

  if (normalized.source !== "manual") {
    throw {
      status: 400,
      message: "Only manual customers can be created from the CRM API for now",
    };
  }

  const duplicate = await Customer.findActiveByEmail(normalized.email);
  if (duplicate) {
    throw {
      status: 409,
      message: "A customer with this email already exists",
    };
  }

  const allowSyncSource = PRIVILEGED_VIEW_ROLES.has(creator.role);
  const assignments = await resolveAndValidateAssignments(body.services, {
    allowSyncSource,
  });

  const created = await Customer.create({
    ...normalized,
    createdBy: creator.id,
  });

  if (assignments && assignments.length > 0) {
    await CustomerService.syncForCustomer(created.id, assignments);
  }

  const full = await Customer.findById(created.id);
  return full || created;
};

export const listCustomers = async (viewer, { limit, offset } = {}) => {
  const isPrivileged = PRIVILEGED_VIEW_ROLES.has(viewer.role);
  const [items, total] = await Promise.all([
    isPrivileged
      ? Customer.findAllWithAddedBy({ limit, offset })
      : Customer.findByCreatorWithAddedBy(viewer.id, { limit, offset }),
    isPrivileged ? Customer.countAll() : Customer.countByCreator(viewer.id),
  ]);
  return { items, total, limit, offset };
};

export const getCustomerDetails = async (id, viewer) => {
  const customer = await Customer.findById(id);
  if (!customer) {
    throw { status: 404, message: "Customer not found" };
  }

  if (!PRIVILEGED_VIEW_ROLES.has(viewer.role) && customer.created_by !== viewer.id) {
    throw { status: 403, message: "You can only view your own customers" };
  }
  return customer;
};

export const deleteCustomer = async (id, viewer) => {
  const existing = await Customer.findById(id);
  if (!existing) {
    throw { status: 404, message: "Customer not found" };
  }

  if (!PRIVILEGED_VIEW_ROLES.has(viewer.role) && existing.created_by !== viewer.id) {
    throw { status: 403, message: "You can only delete your own customers" };
  }

  const result = await Customer.softDeleteById(id);
  if (!result) {
    throw { status: 404, message: "Customer not found" };
  }
  return { id: result.id, deleted_at: result.deleted_at };
};

export const updateCustomer = async (id, body, viewer) => {
  const existing = await Customer.findById(id);
  if (!existing) {
    throw { status: 404, message: "Customer not found" };
  }

  if (!PRIVILEGED_VIEW_ROLES.has(viewer.role) && existing.created_by !== viewer.id) {
    throw { status: 403, message: "You can only update your own customers" };
  }

  const normalized = validatePayload(body);
  if (!PRIVILEGED_VIEW_ROLES.has(viewer.role)) {
    normalized.source = "manual";
  }

  if (normalized.email && normalized.email !== existing.email) {
    const duplicate = await Customer.findActiveByEmail(normalized.email, {
      excludeId: existing.id,
    });
    if (duplicate) {
      throw {
        status: 409,
        message: "Another customer is already using this email",
      };
    }
  }

  const allowSyncSource = PRIVILEGED_VIEW_ROLES.has(viewer.role);
  const assignments = await resolveAndValidateAssignments(body.services, {
    allowSyncSource,
  });

  const updated = await Customer.updateById(id, normalized);
  if (!updated) {
    throw { status: 404, message: "Customer not found" };
  }

  if (assignments !== null) {
    await CustomerService.syncForCustomer(id, assignments);
  }

  const full = await Customer.findById(id);
  return full || updated;
};

/**
 * Map Velox eSIM CRM API payloads to stable DTOs for the Velox-CRM app.
 */

/**
 * @param {unknown} raw
 * @returns {object}
 */
export function mapVeloxPurchase(raw) {
  if (!raw || typeof raw !== "object") return {};
  const p = /** @type {Record<string, unknown>} */ (raw);
  return {
    orderId: p.orderId ?? null,
    orderNo: p.orderNo ?? null,
    planCode: p.planCode ?? null,
    planName: p.planName ?? null,
    planType: p.planType ?? null,
    countryCode: p.countryCode ?? null,
    region: p.region ?? null,
    amountPaid: typeof p.amountPaid === "number" ? p.amountPaid : Number(p.amountPaid) || 0,
    currency: p.currency ?? "USD",
    status: p.status ?? null,
    purchasedAt: p.purchasedAt ?? null,
  };
}

/**
 * @param {unknown} raw
 * @returns {object}
 */
export function mapVeloxCustomer(raw) {
  if (!raw || typeof raw !== "object") {
    throw { status: 502, message: "Invalid customer payload from Velox eSIM API" };
  }
  const c = /** @type {Record<string, unknown>} */ (raw);
  const purchases = Array.isArray(c.purchases) ? c.purchases.map(mapVeloxPurchase) : [];

  return {
    id: String(c.id ?? ""),
    name: c.name ?? "",
    email: c.email ?? "",
    phone: c.phone ?? null,
    country: c.country ?? null,
    countryCode: c.countryCode ?? null,
    isActive: Boolean(c.isActive),
    registeredAt: c.registeredAt ?? null,
    totalOrders: typeof c.totalOrders === "number" ? c.totalOrders : Number(c.totalOrders) || 0,
    totalSpent: typeof c.totalSpent === "number" ? c.totalSpent : Number(c.totalSpent) || 0,
    lastPurchaseAt: c.lastPurchaseAt ?? null,
    purchases,
  };
}

/**
 * @param {unknown} envelope — Velox `{ success, message, data }`
 * @returns {{ customers: object[]; pagination: object }}
 */
export function mapVeloxCustomerListResponse(envelope) {
  if (!envelope || typeof envelope !== "object") {
    throw { status: 502, message: "Invalid list response from Velox eSIM API" };
  }
  const root = /** @type {Record<string, unknown>} */ (envelope);
  const data = root.data && typeof root.data === "object" ? root.data : {};
  const d = /** @type {Record<string, unknown>} */ (data);
  const customers = Array.isArray(d.customers) ? d.customers.map(mapVeloxCustomer) : [];
  const paginationRaw =
    d.pagination && typeof d.pagination === "object" ? d.pagination : {};

  const pagination = {
    total: Number(paginationRaw.total) || customers.length,
    page: Number(paginationRaw.page) || 1,
    limit: Number(paginationRaw.limit) || customers.length,
    pages: Number(paginationRaw.pages) || 1,
  };

  return { customers, pagination };
}

/**
 * @param {unknown} envelope
 * @returns {object}
 */
export function mapVeloxCustomerDetailResponse(envelope) {
  if (!envelope || typeof envelope !== "object") {
    throw { status: 502, message: "Invalid detail response from Velox eSIM API" };
  }
  const root = /** @type {Record<string, unknown>} */ (envelope);
  const data = root.data && typeof root.data === "object" ? root.data : {};
  const d = /** @type {Record<string, unknown>} */ (data);
  if (!d.customer) {
    throw { status: 404, message: "Customer not found on Velox eSIM platform" };
  }
  return { customer: mapVeloxCustomer(d.customer) };
}

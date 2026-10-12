import { describe, it, expect } from "vitest";
import {
  mapVeloxCustomer,
  mapVeloxCustomerListResponse,
  mapVeloxPurchase,
} from "../src/integrations/veloxEsim/mappers.js";
import { VELOX_ESIM_VIEW_ROLES } from "../src/integrations/veloxEsim/config.js";

describe("veloxEsim mappers", () => {
  it("mapVeloxPurchase normalizes purchase fields", () => {
    const p = mapVeloxPurchase({
      orderId: "ord1",
      orderNo: "ORD-1",
      planCode: "JP_5GB_30D",
      planName: "Japan 5GB",
      planType: "country_specific",
      countryCode: "JP",
      region: null,
      amountPaid: 15,
      currency: "USD",
      status: "active",
      purchasedAt: "2025-05-01T10:30:00.000Z",
    });
    expect(p.planType).toBe("country_specific");
    expect(p.countryCode).toBe("JP");
    expect(p.amountPaid).toBe(15);
  });

  it("mapVeloxPurchase passes the AUD card charge through", () => {
    const p = mapVeloxPurchase({
      orderNo: "ORD-2",
      amountPaid: 57.44,
      currency: "INR",
      cardChargeAmount: 0.86,
      cardChargeCurrency: "AUD",
    });
    expect(p.amountPaid).toBe(57.44);
    expect(p.currency).toBe("INR");
    expect(p.cardChargeAmount).toBe(0.86);
    expect(p.cardChargeCurrency).toBe("AUD");
  });

  it("mapVeloxPurchase keeps a missing card charge as null, never 0", () => {
    const explicit = mapVeloxPurchase({ amountPaid: 57.85, currency: "INR", cardChargeAmount: null, cardChargeCurrency: null });
    expect(explicit.cardChargeAmount).toBeNull();
    expect(explicit.cardChargeCurrency).toBeNull();

    const absent = mapVeloxPurchase({ amountPaid: 57.85, currency: "INR" });
    expect(absent.cardChargeAmount).toBeNull();
    expect(absent.cardChargeCurrency).toBeNull();
  });

  it("mapVeloxCustomer maps AUD card totals and keeps absent ones null", () => {
    const withTotals = mapVeloxCustomer({
      id: "clx1",
      totalSpent: 57.44,
      totalSpentCurrency: "INR",
      preferredCurrency: "INR",
      cardChargeCurrency: "AUD",
      totalCardCharged: 0.86,
      totalCardRefunded: 0,
      netCardCharged: 0.86,
      purchases: [],
    });
    expect(withTotals.totalSpent).toBe(57.44);
    expect(withTotals.cardChargeCurrency).toBe("AUD");
    expect(withTotals.totalCardCharged).toBe(0.86);
    expect(withTotals.totalCardRefunded).toBe(0);
    expect(withTotals.netCardCharged).toBe(0.86);

    const older = mapVeloxCustomer({ id: "clx2", totalSpent: 10, purchases: [] });
    expect(older.cardChargeCurrency).toBeNull();
    expect(older.totalCardCharged).toBeNull();
    expect(older.totalCardRefunded).toBeNull();
    expect(older.netCardCharged).toBeNull();
  });

  it("mapVeloxCustomerListResponse maps envelope", () => {
    const result = mapVeloxCustomerListResponse({
      success: true,
      data: {
        customers: [
          {
            id: "clx1",
            name: "Jane",
            email: "j@ex.com",
            phone: null,
            isActive: true,
            totalOrders: 1,
            totalSpent: 10,
            purchases: [],
          },
        ],
        pagination: { total: 1, page: 1, limit: 50, pages: 1 },
      },
    });
    expect(result.customers).toHaveLength(1);
    expect(result.customers[0].email).toBe("j@ex.com");
    expect(result.pagination.total).toBe(1);
  });
});

describe("veloxEsim config", () => {
  it("VELOX_ESIM_VIEW_ROLES is super_admin and admin only", () => {
    expect(VELOX_ESIM_VIEW_ROLES).toEqual(["super_admin", "admin"]);
  });
});

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

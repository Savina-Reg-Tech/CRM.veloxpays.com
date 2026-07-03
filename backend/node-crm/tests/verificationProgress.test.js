import { describe, it, expect } from "vitest";
import { computeProgress } from "../src/services/verificationService.js";

const doc = (doc_type, status, extra = {}) => ({
  id: Math.floor(Math.random() * 1e6),
  doc_type,
  status,
  review_note: null,
  ...extra,
});

const EMPLOYEE_REQUIRED = [
  "passport",
  "driving_license",
  "proof_of_address",
  "experience_letter",
  "police_verification",
];

describe("computeProgress", () => {
  it("reports pending with placeholders when nothing is uploaded", () => {
    const p = computeProgress("employee", [], "pending");
    expect(p.uploaded).toBe(0);
    expect(p.required_total).toBe(5);
    expect(p.required_approved).toBe(0);
    expect(p.can_activate).toBe(false);
    expect(p.overall_status).toBe("pending");
    expect(p.documents).toHaveLength(5);
    expect(p.documents.every((d) => d.status === "not_uploaded")).toBe(true);
  });

  it("can_activate becomes true when all required docs are approved", () => {
    const docs = EMPLOYEE_REQUIRED.map((t) => doc(t, "approved"));
    const p = computeProgress("employee", docs, "pending");
    expect(p.required_approved).toBe(5);
    expect(p.can_activate).toBe(true);
    expect(p.overall_status).toBe("approved");
  });

  it("surfaces 'rejected' when a required document is rejected", () => {
    const docs = [
      doc("passport", "approved"),
      doc("driving_license", "rejected", { review_note: "Blurry" }),
    ];
    const p = computeProgress("employee", docs, "pending");
    expect(p.overall_status).toBe("rejected");
    expect(p.can_activate).toBe(false);
  });

  it("surfaces 'under_review' when a document is in review and none rejected", () => {
    const docs = [doc("passport", "in_review"), doc("driving_license", "pending")];
    const p = computeProgress("employee", docs, "pending");
    expect(p.overall_status).toBe("under_review");
  });

  it("account status overrides derived status", () => {
    expect(computeProgress("employee", [], "active").overall_status).toBe("activated");
    expect(computeProgress("employee", [], "expired").overall_status).toBe("expired");
    expect(computeProgress("employee", [], "suspended").overall_status).toBe("suspended");
  });
});

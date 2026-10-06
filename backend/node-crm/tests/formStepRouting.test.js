import { describe, it, expect } from "vitest";
import { getVisitedStepIds } from "../src/services/ruleEngine.js";

// Mirrors the UAT form: Step 2 → (Meet & Greet country is Bangladesh) → Step 1,
// Step 3 → (Service Type is Arrival +2) → Step 4. Step 3 holds a required field.
const steps = [
  { id: "s2", fieldIds: ["country"] },
  { id: "s3", fieldIds: ["service_type", "mandatory_s3"] },
  { id: "s1", fieldIds: ["name"] },
  { id: "s4", fieldIds: ["notes"] },
  { id: "done", isOnSubmit: true, fieldIds: [] },
];
const rules = [
  {
    id: "r1", enabled: true, fromStepId: "s2",
    group: { logic: "AND", conditions: [{ fieldId: "country", operator: "equals", value: "Bangladesh" }] },
    actions: [{ type: "goto_step", stepId: "s1" }],
  },
  {
    id: "r2", enabled: true, fromStepId: "s3",
    group: { logic: "AND", conditions: [{ fieldId: "service_type", operator: "equals", value: "Arrival +2" }] },
    actions: [{ type: "goto_step", stepId: "s4" }],
  },
];

describe("getVisitedStepIds", () => {
  it("excludes a step a goto_step rule routed past", () => {
    const visited = getVisitedStepIds(rules, steps, { country: "Bangladesh" });
    expect([...visited]).toEqual(["s2", "s1", "s4"]);
  });

  it("walks every step in order when no rule matches", () => {
    const visited = getVisitedStepIds(rules, steps, { country: "India", service_type: "Departure" });
    expect([...visited]).toEqual(["s2", "s3", "s1", "s4"]);
  });

  it("follows chained rules", () => {
    const visited = getVisitedStepIds(rules, steps, { country: "India", service_type: "Arrival +2" });
    expect([...visited]).toEqual(["s2", "s3", "s4"]);
  });

  it("stops at end_form and on skip_step skips the named step", () => {
    const endRules = [{ id: "e", enabled: true, fromStepId: "s2", group: { logic: "AND", conditions: [] }, actions: [{ type: "end_form" }] }];
    expect([...getVisitedStepIds(endRules, steps, {})]).toEqual(["s2"]);
    const skipRules = [{ id: "k", enabled: true, fromStepId: "s2", group: { logic: "AND", conditions: [] }, actions: [{ type: "skip_step", stepId: "s3" }] }];
    expect([...getVisitedStepIds(skipRules, steps, {})]).toEqual(["s2", "s1", "s4"]);
  });

  it("terminates on a routing loop", () => {
    const loop = [{ id: "l", enabled: true, fromStepId: "s3", group: { logic: "AND", conditions: [] }, actions: [{ type: "goto_step", stepId: "s2" }] }];
    expect([...getVisitedStepIds(loop, steps, {})]).toEqual(["s2", "s3"]);
  });

  it("returns null for single-step forms", () => {
    expect(getVisitedStepIds(rules, [], {})).toBeNull();
  });
});

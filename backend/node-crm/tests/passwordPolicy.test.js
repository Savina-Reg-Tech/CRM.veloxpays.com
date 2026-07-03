import { describe, it, expect } from "vitest";
import { validatePassword } from "../src/utils/passwordPolicy.js";

describe("validatePassword", () => {
  // Documented happy path: a password that satisfies every rule.
  it("accepts a fully valid password", () => {
    expect(validatePassword("StrongPass1!")).toEqual({ valid: true });
  });

  it("rejects undefined / null / non-string inputs", () => {
    expect(validatePassword(undefined).valid).toBe(false);
    expect(validatePassword(null).valid).toBe(false);
    expect(validatePassword(12345678910).valid).toBe(false);
  });

  it("rejects passwords with leading/trailing spaces", () => {
    const result = validatePassword(" StrongPass1! ");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/leading or trailing spaces/i);
  });

  it("rejects passwords shorter than 10 chars", () => {
    const result = validatePassword("Abc1!def");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/between 10 and 128/i);
  });

  it("rejects passwords missing uppercase", () => {
    const result = validatePassword("strongpass1!");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/uppercase/i);
  });

  it("rejects passwords missing lowercase", () => {
    const result = validatePassword("STRONGPASS1!");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/lowercase/i);
  });

  it("rejects passwords missing a digit", () => {
    const result = validatePassword("StrongPass!!");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/number/i);
  });

  it("rejects passwords missing a special character", () => {
    const result = validatePassword("StrongPass11");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/special character/i);
  });
});

import { describe, it, expect } from "vitest";
import { findEnvProblems } from "../src/config/validateEnv.js";

const strong = "9f2c4b7a1d8e6f305a4c9b2e7d1f8a63c5e0b4d79a2f6c18";

describe("startup secret checks", () => {
  it("accepts a long random secret in production", () => {
    expect(findEnvProblems({ NODE_ENV: "production", JWT_SECRET: strong })).toEqual([]);
  });

  it("always requires JWT_SECRET", () => {
    expect(findEnvProblems({ NODE_ENV: "development" })).toHaveLength(1);
    expect(findEnvProblems({ NODE_ENV: "production", JWT_SECRET: "" })).toHaveLength(1);
  });

  it("rejects short secrets in production", () => {
    expect(findEnvProblems({ NODE_ENV: "production", JWT_SECRET: "a1b2c3d4e5f6a7b8c" }).join(" ")).toMatch(/too short/);
  });

  it.each([
    "change_me_to_a_long_random_string_please_now",
    "your_super_secret_jwt_key_here_0123456789",
    // the fill-in marker in .env.production, if nobody replaced it
    "REPLACE_WITH_JENKINS_velox-jwt-secret",
  ])(
    "rejects the example placeholder %s in production",
    (secret) => {
      expect(findEnvProblems({ NODE_ENV: "production", JWT_SECRET: secret }).join(" ")).toMatch(/placeholder/);
    }
  );

  it("does not block local development with a weak secret", () => {
    expect(findEnvProblems({ NODE_ENV: "development", JWT_SECRET: "dev" })).toEqual([]);
  });
});

describe("session cookie Secure flag", async () => {
  const { resolveCookieSecure } = await import("../src/controllers/authController.js");

  it("is on by default in production", () => {
    expect(resolveCookieSecure({ NODE_ENV: "production" })).toBe(true);
  });
  it("is off by default in development", () => {
    expect(resolveCookieSecure({ NODE_ENV: "development" })).toBe(false);
    expect(resolveCookieSecure({})).toBe(false);
  });
  it("COOKIE_SECURE overrides either way", () => {
    expect(resolveCookieSecure({ NODE_ENV: "production", COOKIE_SECURE: "false" })).toBe(false);
    expect(resolveCookieSecure({ NODE_ENV: "development", COOKIE_SECURE: "TRUE" })).toBe(true);
  });
});

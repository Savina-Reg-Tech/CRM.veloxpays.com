import { describe, it, expect, beforeEach, vi } from "vitest";

// MX checks on public-form emails. A failed lookup says nothing about the domain, so it must
// never reject the address — and must not be cached, or one slow DNS answer for gmail.com
// would turn away every Gmail lead for a day.

vi.mock("../config/db.js", () => ({ query: vi.fn(), getClient: vi.fn(), default: {} }));

const resolveMx = vi.fn();
vi.mock("dns", () => ({ promises: { resolveMx: (...a) => resolveMx(...a) } }));

const dnsError = (code) => Object.assign(new Error(code), { code });

let validateEmail;
beforeEach(async () => {
  resolveMx.mockReset();
  vi.resetModules(); // fresh module → empty MX cache
  vi.spyOn(console, "warn").mockImplementation(() => {});
  ({ validateEmail } = await import("../src/services/spamService.js"));
});

describe("validateEmail — MX lookups", () => {
  it("accepts a domain with MX records", async () => {
    resolveMx.mockResolvedValue([{ exchange: "mx.example.org", priority: 10 }]);
    expect(await validateEmail("lead@example.org")).toEqual({ valid: true });
  });

  it("rejects a domain that does not exist", async () => {
    resolveMx.mockRejectedValue(dnsError("ENOTFOUND"));
    expect((await validateEmail("lead@no-such-domain.example")).valid).toBe(false);
  });

  it("rejects a domain with no MX records", async () => {
    resolveMx.mockRejectedValue(dnsError("ENODATA"));
    expect((await validateEmail("lead@nomail.example")).valid).toBe(false);
  });

  it("accepts the address when the lookup itself fails, and does not cache the failure", async () => {
    resolveMx.mockRejectedValueOnce(dnsError("ESERVFAIL"));
    expect(await validateEmail("lead@gmail.com")).toEqual({ valid: true });

    // The next submission asks DNS again instead of reusing a cached "no MX".
    resolveMx.mockRejectedValueOnce(dnsError("ENODATA"));
    expect((await validateEmail("lead@gmail.com")).valid).toBe(false);
    expect(resolveMx).toHaveBeenCalledTimes(2);
  });

  it("caches a definite answer", async () => {
    resolveMx.mockResolvedValue([{ exchange: "mx.example.org", priority: 10 }]);
    await validateEmail("a@example.org");
    await validateEmail("b@example.org");
    expect(resolveMx).toHaveBeenCalledTimes(1);
  });

  it("accepts the address when the lookup times out", async () => {
    vi.useFakeTimers();
    try {
      resolveMx.mockReturnValue(new Promise(() => {})); // never answers
      const pending = validateEmail("lead@slow-dns.example");
      await vi.advanceTimersByTimeAsync(5000);
      expect(await pending).toEqual({ valid: true });
    } finally {
      vi.useRealTimers();
    }
  });
});

import { describe, it, expect, vi } from "vitest";

const { checkVeloxVerse, createHealthMonitor, formatDuration } = await import("../src/jobs/veloxverseHealthMonitor.js");

describe("checkVeloxVerse", () => {
  it("is up only on HTTP 200, and keeps only the status code — never the body", async () => {
    expect((await checkVeloxVerse({ get: async () => ({ status: 200 }), url: "x" })).up).toBe(true);
    const down = await checkVeloxVerse({ get: async () => ({ status: 503, data: { secret: "db password" } }), url: "x" });
    expect(down).toMatchObject({ up: false, status: 503, error: "HTTP 503" });
    expect(JSON.stringify(down)).not.toContain("secret");
  });

  it("turns a timeout or network failure into a short reason instead of throwing", async () => {
    const timeout = await checkVeloxVerse({ get: async () => { throw Object.assign(new Error("t"), { code: "ECONNABORTED" }); }, url: "x" });
    expect(timeout).toMatchObject({ up: false, status: null, error: "no answer within 5s" });
    const refused = await checkVeloxVerse({ get: async () => { throw Object.assign(new Error("r"), { code: "ECONNREFUSED" }); }, url: "x" });
    expect(refused.error).toBe("ECONNREFUSED");
  });
});

describe("createHealthMonitor", () => {
  const results = (...ups) => {
    const queue = [...ups];
    return async () => ({ up: queue.shift(), error: "HTTP 503" });
  };

  it("does not alert on a single blip", async () => {
    const alert = vi.fn();
    const m = createHealthMonitor({ check: results(false, true), alert, failuresBeforeAlert: 3 });
    await m.tick();
    await m.tick();
    expect(alert).not.toHaveBeenCalled();
  });

  it("alerts once per outage after N failures in a row, then once when it recovers", async () => {
    const alert = vi.fn();
    let t = new Date("2026-10-27T10:00:00Z").getTime();
    const now = () => new Date(t);
    const m = createHealthMonitor({ check: results(false, false, false, false, false, true), alert, failuresBeforeAlert: 3, now });
    for (let i = 0; i < 5; i++) {
      await m.tick();
      t += 2 * 60_000;
    }
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toBe("down");
    expect(alert.mock.calls[0][1]).toMatchObject({ failures: 3, error: "HTTP 503" });
    await m.tick();
    expect(alert).toHaveBeenCalledTimes(2);
    expect(alert.mock.calls[1][0]).toBe("recovered");
    expect(alert.mock.calls[1][1].downFor).toBe("10 min");
    expect(m.state).toMatchObject({ consecutiveFailures: 0, alerted: false, downSince: null });
  });

  it("says nothing on recovery when no down alert was sent", async () => {
    const alert = vi.fn();
    const m = createHealthMonitor({ check: results(false, true), alert, failuresBeforeAlert: 3 });
    await m.tick();
    await m.tick();
    expect(alert).not.toHaveBeenCalled();
  });
});

describe("formatDuration", () => {
  it("reads naturally", () => {
    expect(formatDuration(20_000)).toBe("under a minute");
    expect(formatDuration(12 * 60_000)).toBe("12 min");
    expect(formatDuration(65 * 60_000)).toBe("1 h 5 min");
    expect(formatDuration(120 * 60_000)).toBe("2 h");
  });
});

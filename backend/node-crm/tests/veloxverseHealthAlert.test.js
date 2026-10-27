import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const findModerators = vi.fn();
const notify = vi.fn();
const sendMail = vi.fn();
vi.mock("../src/models/User.js", () => ({ default: { findModerators } }));
vi.mock("../src/services/notificationService.js", () => ({ notify }));
vi.mock("../src/utils/mailer.js", () => ({ sendMail }));

const { sendVeloxVerseAlert } = await import("../src/jobs/veloxverseHealthMonitor.js");

describe("sendVeloxVerseAlert", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    findModerators.mockResolvedValue([
      { id: 1, email: "boss@velox.com" },
      { id: 2, email: "ops@velox.com" },
    ]);
    process.env.VELOXVERSE_ALERT_EMAILS = "OPS@velox.com, oncall@velox.com";
  });
  afterEach(() => {
    vi.restoreAllMocks();
    notify.mockReset();
    sendMail.mockReset();
    delete process.env.VELOXVERSE_ALERT_EMAILS;
  });

  it("alerts every admin in-app + email, and extra addresses without doubling an admin's", async () => {
    await sendVeloxVerseAlert("down", { downSince: new Date("2026-10-27T10:00:00Z"), failures: 3, error: "HTTP 503" });
    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify.mock.calls[0][0]).toMatchObject({ event: "veloxverse_down", title: "VeloxVerse is not responding" });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].to).toBe("oncall@velox.com");
  });

  it("still emails the extra addresses when the admin list can't be loaded", async () => {
    findModerators.mockRejectedValueOnce(new Error("db down"));
    await sendVeloxVerseAlert("recovered", { downSince: new Date("2026-10-27T10:00:00Z"), downFor: "12 min" });
    expect(notify).not.toHaveBeenCalled();
    expect(sendMail.mock.calls.map((c) => c[0].to)).toEqual(["OPS@velox.com", "oncall@velox.com"]);
    expect(sendMail.mock.calls[0][0].subject).toBe("VeloxVerse is back up");
  });
});

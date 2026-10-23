import { describe, it, expect } from "vitest";

const { isFileDownloadPath } = await import("../src/middleware/veloxverseProxy.js");

// Only these paths are passed through as raw bytes; everything else is parsed as JSON.
describe("isFileDownloadPath", () => {
  it("treats CSV exports as files", () => {
    expect(isFileDownloadPath("/admin/audit/export.csv")).toBe(true);
  });

  it("treats a ViaTovia email attachment as a file", () => {
    expect(isFileDownloadPath("/admin/assist/transfer/inbox/abc123/attachments/att_1")).toBe(true);
  });

  it("keeps JSON endpoints as JSON", () => {
    expect(isFileDownloadPath("/admin/assist/transfer/inbox/abc123")).toBe(false);
    expect(isFileDownloadPath("/admin/assist/transfer/inbox/abc123/attachments")).toBe(false);
    expect(isFileDownloadPath("/admin/assist/transfer/drafts/d1")).toBe(false);
    expect(isFileDownloadPath(undefined)).toBe(false);
  });
});

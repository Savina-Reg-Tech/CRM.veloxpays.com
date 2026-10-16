import { describe, it, expect, beforeEach, vi } from "vitest";

// A storage failure while serving a form upload must become an error response. Express 4 ignores
// the promise a handler returns, so a rejection escaping the handler's try/catch is an unhandled
// rejection — which takes the whole process down.

vi.mock("../config/db.js", () => ({ query: vi.fn(), getClient: vi.fn(), default: {} }));

const findSubmission = vi.fn();
const findLead = vi.fn();
vi.mock("../src/models/FormSubmission.js", () => ({ default: { findById: (...a) => findSubmission(...a) } }));
vi.mock("../src/models/Lead.js", () => ({ default: { findById: (...a) => findLead(...a) } }));

const getSignedUrl = vi.fn();
const read = vi.fn();
vi.mock("../src/storage/index.js", () => ({
  storage: { getSignedUrl: (...a) => getSignedUrl(...a), read: (...a) => read(...a) },
  contentDisposition: () => "inline",
}));

const { handleDownloadSubmissionFile, handleDownloadLeadFile } = await import(
  "../src/controllers/formController.js"
);

const descriptor = {
  __type: "file",
  storagePath: "form-submissions/form-1/abc.pdf",
  originalName: "abc.pdf",
  mimeType: "application/pdf",
};

function fakeRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.setHeader = vi.fn();
  res.send = vi.fn(() => res);
  res.redirect = vi.fn(() => res);
  return res;
}

describe("form file downloads — storage failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSignedUrl.mockResolvedValue(null);
    read.mockRejectedValue(Object.assign(new Error("File not found in storage"), { status: 404 }));
  });

  it("submission download answers with the storage error instead of rejecting", async () => {
    findSubmission.mockResolvedValue({ form_id: 1, submission_data: { f1: descriptor } });
    const res = fakeRes();
    const req = { params: { id: "1", submissionId: "5", fieldId: "f1" } };

    await expect(handleDownloadSubmissionFile(req, res)).resolves.not.toThrow();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("lead download answers with 500 when signing the URL fails", async () => {
    findLead.mockResolvedValue({ submission_data: { f1: descriptor } });
    getSignedUrl.mockRejectedValue(new Error("S3 unreachable"));
    const res = fakeRes();
    const req = { params: { leadId: "9", fieldId: "f1" } };

    await expect(handleDownloadLeadFile(req, res)).resolves.not.toThrow();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

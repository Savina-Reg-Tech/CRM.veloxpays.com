import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";

// Anonymous visitors post files to /public/forms/:id/submit. Nothing may be stored unless it is
// going into a real file field of a live form, and nothing may outlive a refused submission.

let formRow;
const mockQuery = vi.fn(async (sql) =>
  /FROM forms/i.test(sql) ? { rows: formRow ? [formRow] : [], rowCount: formRow ? 1 : 0 } : { rows: [], rowCount: 0 }
);
vi.mock("../config/db.js", () => ({ query: (...a) => mockQuery(...a), getClient: vi.fn(), default: {} }));

const put = vi.fn(async ({ key }) => ({ storagePath: key }));
const remove = vi.fn(async () => {});
vi.mock("../src/storage/index.js", async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, storage: { ...real.storage, put: (...a) => put(...a), remove: (...a) => remove(...a) } };
});

const processFormSubmission = vi.fn();
vi.mock("../src/services/submissionService.js", () => ({
  processFormSubmission: (...a) => processFormSubmission(...a),
}));

let app;
let request;
beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret-do-not-use-in-prod";
  process.env.NODE_ENV = "test";
  process.env.ALLOWED_ORIGINS = "http://localhost:3001";
  app = (await import("../src/app.js")).default;
  request = (await import("supertest")).default;
});

const PDF = Buffer.from("%PDF-1.4\n%test\n");
const liveForm = () => ({
  id: 3,
  status: "published",
  form_json: { fields: [{ id: "cv", type: "file", label: "CV" }, { id: "name", type: "text", label: "Name" }] },
});
const submit = (fieldname = "cv", payload = JSON.stringify({ data: { name: "Jo" } })) =>
  request(app)
    .post("/public/forms/3/submit")
    .field("payload", payload)
    .attach(fieldname, PDF, { filename: "cv.pdf", contentType: "application/pdf" });

beforeEach(() => {
  vi.clearAllMocks();
  formRow = liveForm();
  processFormSubmission.mockResolvedValue({ submission: { id: 11 }, lead: { id: 22 }, status: "NEW", spamScore: 0 });
});

describe("public form uploads", () => {
  it("stores a file for a real file field of a published form", async () => {
    const res = await submit();
    expect(res.status).toBe(201);
    expect(put).toHaveBeenCalledTimes(1);
    expect(processFormSubmission.mock.calls[0][0].data.cv.storagePath).toMatch(/^form-submissions\/3\//);
  });

  it("stores nothing for a form that does not exist", async () => {
    formRow = null;
    expect((await submit()).status).toBe(404);
    expect(put).not.toHaveBeenCalled();
  });

  it("stores nothing for an unpublished form", async () => {
    formRow = { ...liveForm(), status: "draft" };
    expect((await submit()).status).toBe(403);
    expect(put).not.toHaveBeenCalled();
  });

  it("stores nothing for a part that is not a file field", async () => {
    expect((await submit("name")).status).toBe(400);
    expect((await submit("made-up")).status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });

  it("removes stored files when the submission is refused", async () => {
    processFormSubmission.mockRejectedValue({ status: 400, message: "Name is required", errors: [] });
    expect((await submit()).status).toBe(400);
    expect(put).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(put.mock.calls[0][0].key);
  });

  it("answers 400, not 500, for a malformed payload", async () => {
    expect((await submit("cv", "{not json")).status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });
});

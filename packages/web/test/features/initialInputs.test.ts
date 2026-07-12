import { describe, it, expect } from "vitest";
import { sampleFromSchema, skeletonFromSchema, initialInputsFor } from "../../src/features/request/initialInputs.js";
import type { Operation } from "@swaggy/shared";

describe("sampleFromSchema", () => {
  it("prefers example", () => {
    expect(sampleFromSchema({ type: "object", example: { a: 1 } })).toEqual({ a: 1 });
  });
  it("falls back to default", () => {
    expect(sampleFromSchema({ type: "string", default: "hi" })).toBe("hi");
  });
  it("does not fabricate values for properties without a declared default", () => {
    // Optional fields with no default are omitted (not seeded with ""/0), so they don't
    // trip live validation before the user enters anything. An object that seeds nothing
    // is dropped entirely (returns undefined) rather than an empty {} — otherwise an
    // optional object would fail its own required-children check while untouched.
    expect(sampleFromSchema({ type: "object", properties: { name: { type: "string" }, age: { type: "integer" } } }))
      .toBeUndefined();
  });
  it("omits an optional object with required children so it isn't validated while untouched", () => {
    expect(
      sampleFromSchema({ type: "object", properties: { address: { type: "object", required: ["country"], properties: { country: { type: "string" } } } } }),
    ).toBeUndefined();
  });
  it("keeps only the properties that declare a default/example", () => {
    expect(
      sampleFromSchema({
        type: "object",
        properties: { a: { type: "string", default: "x" }, b: { type: "string" }, c: { type: "integer", example: 5 } },
      }),
    ).toEqual({ a: "x", c: 5 });
  });
  it("returns undefined for an array without a declared default", () => {
    expect(sampleFromSchema({ type: "array", items: { type: "string" } })).toBeUndefined();
  });
});

describe("skeletonFromSchema", () => {
  it("includes every field — required AND optional", () => {
    expect(
      skeletonFromSchema({ type: "object", required: ["a"], properties: { a: { type: "string" }, b: { type: "integer" }, c: { type: "boolean" } } }),
    ).toEqual({ a: "", b: 0, c: false });
  });
  it("honors example/default and uses the first enum value", () => {
    expect(skeletonFromSchema({ example: 5 })).toBe(5);
    expect(skeletonFromSchema({ type: "string", default: "d" })).toBe("d");
    expect(skeletonFromSchema({ type: "string", enum: ["x", "y"] })).toBe("x");
  });
  it("shows one representative item for arrays and recurses into nested objects", () => {
    expect(skeletonFromSchema({ type: "array", items: { type: "object", properties: { n: { type: "number" } } } })).toEqual([{ n: 0 }]);
  });
});

describe("initialInputsFor", () => {
  const op: Operation = {
    id: "x", specId: "s", specTitle: "S", method: "POST", path: "/x", summary: "", description: "",
    tags: [], servers: ["https://a.com"],
    pathParams: [{ name: "id", in: "path", schema: { type: "string" }, required: true, default: "7" }],
    queryParams: [{ name: "verbose", in: "query", schema: { type: "boolean" }, required: false, default: true }],
    headerParams: [],
    requestBody: { contentType: "application/json", jsonSchema: { type: "object", example: { n: 1 } } },
    responses: [],
  };
  it("seeds path/query defaults and body from schema", () => {
    const inputs = initialInputsFor(op);
    expect(inputs.server).toBe("https://a.com");
    expect(inputs.pathParams.id).toBe("7");
    expect(inputs.query.verbose).toBe("true");
    expect(inputs.body).toEqual({ n: 1 });
  });
  it("uses empty server when none declared", () => {
    expect(initialInputsFor({ ...op, servers: [] }).server).toBe("");
  });
});

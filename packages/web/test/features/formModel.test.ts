import { describe, it, expect } from "vitest";
import { formMode, initialFormParts, toUrlEncoded, toMultipartParts, type FormPart } from "../../src/features/request/formModel.js";
import type { Operation } from "@swaggy/shared";

const op = (contentType: string, schema: unknown): Operation =>
  ({
    id: "files:upload", specId: "s", operationId: "upload", method: "POST", path: "/upload",
    summary: "", tags: [], pathParams: [], queryParams: [], headerParams: [],
    requestBody: { contentType, jsonSchema: schema }, responses: [], servers: ["https://x"],
  }) as unknown as Operation;

const schema = {
  type: "object",
  required: ["file"],
  properties: {
    file: { type: "string", format: "binary" },
    caption: { type: "string" },
  },
};

describe("formMode", () => {
  it("classifies form content types", () => {
    expect(formMode("multipart/form-data")).toBe("multipart");
    expect(formMode("application/x-www-form-urlencoded")).toBe("urlencoded");
    expect(formMode("application/json")).toBeNull();
    expect(formMode(undefined)).toBeNull();
  });
});

describe("initialFormParts", () => {
  it("seeds a file picker for binary fields under multipart, marking required", () => {
    const parts = initialFormParts(op("multipart/form-data", schema));
    expect(parts.map((p) => [p.name, p.kind, p.required])).toEqual([
      ["file", "file", true],
      ["caption", "text", false],
    ]);
    expect(parts.every((p) => p.fromSchema && p.enabled)).toBe(true);
  });

  it("never makes file fields under urlencoded (it can't carry files)", () => {
    const parts = initialFormParts(op("application/x-www-form-urlencoded", schema));
    expect(parts.every((p) => p.kind === "text")).toBe(true);
  });
});

describe("serialization", () => {
  const part = (over: Partial<FormPart>): FormPart =>
    ({ id: "1", name: "a", kind: "text", value: "", files: [], enabled: true, fromSchema: false, required: false, ...over });

  it("toUrlEncoded skips empty/disabled/file rows and interpolates values", () => {
    const parts = [
      part({ name: "a", value: "1" }),
      part({ name: "b", value: "" }),
      part({ name: "c", value: "x", enabled: false }),
      part({ name: "tok", value: "{{token}}" }),
      part({ name: "f", kind: "file", files: [] }),
    ];
    expect(toUrlEncoded(parts, { token: "abc" })).toBe("a=1&tok=abc");
  });

  it("toMultipartParts includes files and interpolated text, skipping empties", () => {
    const f = new File(["data"], "a.png", { type: "image/png" });
    const parts = [
      part({ name: "kind", value: "{{k}}" }),
      part({ name: "img", kind: "file", files: [f] }),
      part({ name: "empty", value: "" }),
      part({ name: "  ", value: "x" }),
    ];
    expect(toMultipartParts(parts, { k: "avatar" })).toEqual([
      { name: "kind", value: "avatar" },
      { name: "img", files: [f] },
    ]);
  });
});

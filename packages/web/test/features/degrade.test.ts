import { describe, it, expect } from "vitest";
import { hasUnsupportedComposition } from "../../src/features/request/degrade.js";

describe("hasUnsupportedComposition", () => {
  it("is false for plain object schemas", () => {
    expect(hasUnsupportedComposition({ type: "object", properties: { a: { type: "string" } } })).toBe(false);
  });
  it("is true when oneOf appears at the top", () => {
    expect(hasUnsupportedComposition({ oneOf: [{ type: "string" }, { type: "number" }] })).toBe(true);
  });
  it("is true when anyOf is nested", () => {
    expect(hasUnsupportedComposition({ type: "object", properties: { a: { anyOf: [{ type: "string" }] } } })).toBe(true);
  });
});

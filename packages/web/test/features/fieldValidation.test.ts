import { describe, it, expect } from "vitest";
import { validateParam } from "../../src/features/request/fieldValidation.js";
import type { Param } from "@swaggy/shared";

const p = (schema: unknown): Param => ({
  name: "x",
  in: "query",
  schema,
  required: false,
});

describe("validateParam", () => {
  it("treats empty/undefined as valid (required is enforced elsewhere)", () => {
    expect(validateParam(p({ type: "integer" }), "")).toBeNull();
    expect(validateParam(p({ type: "integer" }), undefined)).toBeNull();
  });

  it("treats a value containing a {{template}} as valid (resolved at send time)", () => {
    expect(validateParam(p({ type: "integer" }), "{{orderId}}")).toBeNull();
    expect(validateParam(p({ type: "integer", format: "uuid" }), "{{id}}")).toBeNull();
  });

  it("flags non-numeric integers and non-integer numbers", () => {
    expect(validateParam(p({ type: "integer" }), "abc")).toBe("must be a number");
    expect(validateParam(p({ type: "integer" }), "1.5")).toBe("must be an integer");
    expect(validateParam(p({ type: "number" }), "3.14")).toBeNull();
  });

  it("enforces minimum/maximum on numbers", () => {
    expect(validateParam(p({ type: "integer", minimum: 1 }), "0")).toBe("must be ≥ 1");
    expect(validateParam(p({ type: "integer", maximum: 10 }), "11")).toBe("must be ≤ 10");
    expect(validateParam(p({ type: "integer", minimum: 1, maximum: 10 }), "5")).toBeNull();
  });

  it("checks enum membership", () => {
    const schema = { type: "string", enum: ["available", "pending", "sold"] };
    expect(validateParam(p(schema), "nope")).toBe("must be one of: available, pending, sold");
    expect(validateParam(p(schema), "pending")).toBeNull();
  });

  it("validates formats", () => {
    expect(validateParam(p({ type: "string", format: "email" }), "not-an-email")).toBe("must be a valid email");
    expect(validateParam(p({ type: "string", format: "email" }), "a@b.co")).toBeNull();
    expect(validateParam(p({ type: "string", format: "uuid" }), "xyz")).toBe("must be a valid UUID");
    expect(validateParam(p({ type: "string", format: "date" }), "2026-13-40")).toContain("date");
  });

  it("enforces string length and pattern", () => {
    expect(validateParam(p({ type: "string", minLength: 3 }), "ab")).toBe("must be at least 3 characters");
    expect(validateParam(p({ type: "string", maxLength: 2 }), "abc")).toBe("must be at most 2 characters");
    expect(validateParam(p({ type: "string", pattern: "^[a-z]+$" }), "ABC")).toBe("must match ^[a-z]+$");
    expect(validateParam(p({ type: "string", pattern: "^[a-z]+$" }), "abc")).toBeNull();
  });

  it("validates each item of an array-valued param", () => {
    expect(validateParam(p({ type: "integer" }), ["1", "bad"])).toBe("must be a number");
    expect(validateParam(p({ type: "integer" }), ["1", "2"])).toBeNull();
  });
});

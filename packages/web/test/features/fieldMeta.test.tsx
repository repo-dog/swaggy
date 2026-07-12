import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { schemaHint, RequiredBadge, schemaTypeLabel, enumValues, defaultValueHint } from "../../src/features/request/fieldMeta.js";

describe("schemaHint", () => {
  it("omits enum choices (those render as a dropdown that already lists options)", () => {
    expect(schemaHint({ enum: ["a", "b"] })).toBeNull();
    // Other constraints still surface even alongside an enum.
    expect(schemaHint({ enum: ["x"], format: "uuid" })).toBe("uuid");
  });
  it("summarizes format and numeric / length constraints", () => {
    expect(schemaHint({ format: "date-time" })).toBe("date-time");
    expect(schemaHint({ minimum: 1, maximum: 10 })).toBe("min 1 · max 10");
    expect(schemaHint({ minLength: 2, maxLength: 5 })).toBe("≥ 2 chars · ≤ 5 chars");
  });
  it("returns null when there's nothing to hint", () => {
    expect(schemaHint({ type: "string" })).toBeNull();
    expect(schemaHint(undefined)).toBeNull();
    expect(schemaHint(null)).toBeNull();
  });
});

describe("schemaTypeLabel", () => {
  it("labels primitives, objects, and arrays compactly", () => {
    expect(schemaTypeLabel({ type: "string" })).toBe("string");
    expect(schemaTypeLabel({ type: "object", properties: {} })).toBe("object");
    expect(schemaTypeLabel({ properties: {} })).toBe("object");
    expect(schemaTypeLabel({ type: "array", items: { type: "string" } })).toBe("array<string>");
    expect(schemaTypeLabel({ type: "array", items: { type: "object", properties: {} } })).toBe("array<object>");
  });
  it("joins union types and falls back to any", () => {
    expect(schemaTypeLabel({ type: ["string", "null"] })).toBe("string | null");
    expect(schemaTypeLabel({})).toBe("any");
    expect(schemaTypeLabel(undefined)).toBe("any");
  });
});

describe("enumValues", () => {
  it("returns display strings or null", () => {
    expect(enumValues({ enum: ["a", "b"] })).toEqual(["a", "b"]);
    expect(enumValues({ enum: [1, 2] })).toEqual(["1", "2"]);
    expect(enumValues({ type: "string" })).toBeNull();
    expect(enumValues({ enum: [] })).toBeNull();
  });
});

describe("defaultValueHint", () => {
  it("returns the declared default as a string, or null", () => {
    expect(defaultValueHint({ default: "active" })).toBe("active");
    expect(defaultValueHint({ default: false })).toBe("false");
    expect(defaultValueHint({ default: 3 })).toBe("3");
    expect(defaultValueHint({ type: "string" })).toBeNull();
  });
});

describe("RequiredBadge", () => {
  it("labels a field required or optional", () => {
    const { rerender } = render(<RequiredBadge required />);
    expect(screen.getByText("required")).toBeInTheDocument();
    rerender(<RequiredBadge required={false} />);
    expect(screen.getByText("optional")).toBeInTheDocument();
  });
});

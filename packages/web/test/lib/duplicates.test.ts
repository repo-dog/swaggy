import { describe, it, expect } from "vitest";
import { duplicateNameKeys, isDuplicateName } from "../../src/lib/duplicates.js";

describe("duplicateNameKeys", () => {
  it("returns names that appear more than once", () => {
    expect(duplicateNameKeys(["a", "b", "a"])).toEqual(new Set(["a"]));
  });
  it("ignores empty / whitespace-only names", () => {
    expect(duplicateNameKeys(["", "  ", "", "x"])).toEqual(new Set());
  });
  it("trims before comparing", () => {
    expect(duplicateNameKeys(["a", " a "])).toEqual(new Set(["a"]));
  });
  it("is case-sensitive by default and case-insensitive when asked", () => {
    expect(duplicateNameKeys(["A", "a"])).toEqual(new Set());
    expect(duplicateNameKeys(["A", "a"], { caseInsensitive: true })).toEqual(new Set(["a"]));
  });
});

describe("isDuplicateName", () => {
  it("detects a collision with existing names", () => {
    expect(isDuplicateName("prod", ["dev", "prod"])).toBe(true);
    expect(isDuplicateName("stg", ["dev", "prod"])).toBe(false);
  });
  it("an empty name never collides", () => {
    expect(isDuplicateName("   ", ["", "x"])).toBe(false);
  });
  it("honors case-insensitive matching", () => {
    expect(isDuplicateName("Prod", ["prod"])).toBe(false);
    expect(isDuplicateName("Prod", ["prod"], { caseInsensitive: true })).toBe(true);
  });
});

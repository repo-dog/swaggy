import { describe, it, expect } from "vitest";
import { interpolateString, interpolateDeep, unresolvedRefsDeep, hasTemplate } from "../../src/features/request/templating.js";

const vars = { token: "abc", id: "42" };

describe("templating", () => {
  it("interpolates known references and leaves unknown ones untouched", () => {
    expect(interpolateString("Bearer {{token}}", vars)).toBe("Bearer abc");
    expect(interpolateString("/users/{{id}}", vars)).toBe("/users/42");
    expect(interpolateString("/x/{{missing}}", vars)).toBe("/x/{{missing}}");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(interpolateString("{{ token }}", vars)).toBe("abc");
  });

  it("interpolates deeply into arrays and object values", () => {
    const out = interpolateDeep({ url: "/u/{{id}}", tags: ["{{token}}", "x"], n: 5 }, vars);
    expect(out).toEqual({ url: "/u/42", tags: ["abc", "x"], n: 5 });
  });

  it("collects distinct unresolved references across nested values", () => {
    const refs = unresolvedRefsDeep(["{{a}}", { b: "{{b}}", c: ["{{a}}", "{{token}}"] }], vars);
    expect(refs.sort()).toEqual(["a", "b"]);
  });

  it("hasTemplate detects references", () => {
    expect(hasTemplate("{{x}}")).toBe(true);
    expect(hasTemplate("plain")).toBe(false);
  });

  it("does not treat inherited Object.prototype keys as defined variables", () => {
    // {{toString}} / {{constructor}} must be left untouched (own-property check), and
    // reported as unresolved — not silently replaced with a prototype function.
    expect(interpolateString("{{toString}}", vars)).toBe("{{toString}}");
    expect(interpolateString("{{constructor}}", vars)).toBe("{{constructor}}");
    expect(unresolvedRefsDeep(["{{toString}}"], vars)).toEqual(["toString"]);
  });
});

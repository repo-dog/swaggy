import { describe, it, expect } from "vitest";
import { splitHighlight } from "../../src/features/palette/highlight.js";

describe("splitHighlight", () => {
  it("returns the whole string as a non-match for an empty query", () => {
    expect(splitHighlight("/users/{id}", "")).toEqual([{ text: "/users/{id}", match: false }]);
  });

  it("marks a case-insensitive match", () => {
    expect(splitHighlight("GetUser", "user")).toEqual([
      { text: "Get", match: false },
      { text: "User", match: true },
    ]);
  });

  it("marks every occurrence", () => {
    expect(splitHighlight("aXaXa", "a")).toEqual([
      { text: "a", match: true },
      { text: "X", match: false },
      { text: "a", match: true },
      { text: "X", match: false },
      { text: "a", match: true },
    ]);
  });

  it("returns a single non-match when the query is absent", () => {
    expect(splitHighlight("orders", "zzz")).toEqual([{ text: "orders", match: false }]);
  });
});

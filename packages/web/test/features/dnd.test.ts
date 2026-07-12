import { describe, it, expect } from "vitest";
import { reorderById, applyOrder } from "../../src/features/operations/dnd.js";

describe("reorderById", () => {
  it("moves an id to sit immediately before the drop target (downward)", () => {
    expect(reorderById(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "a", "c", "d"]);
  });

  it("moves an id before the drop target (upward)", () => {
    expect(reorderById(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
  });

  it("is a no-op when drag and drop are the same", () => {
    const ids = ["a", "b", "c"];
    expect(reorderById(ids, "b", "b")).toBe(ids);
  });

  it("is a no-op when either id is missing", () => {
    const ids = ["a", "b"];
    expect(reorderById(ids, "x", "a")).toBe(ids);
    expect(reorderById(ids, "a", "x")).toBe(ids);
  });

  it("preserves unrelated ids in place", () => {
    expect(reorderById(["a", "b", "c", "d", "e"], "e", "a")).toEqual(["e", "a", "b", "c", "d"]);
  });
});

describe("applyOrder", () => {
  const items = [{ t: "a" }, { t: "b" }, { t: "c" }];
  const key = (x: { t: string }) => x.t;

  it("orders items by the given key order", () => {
    expect(applyOrder(items, key, ["c", "a", "b"]).map(key)).toEqual(["c", "a", "b"]);
  });

  it("keeps natural order when no order is given", () => {
    expect(applyOrder(items, key, []).map(key)).toEqual(["a", "b", "c"]);
  });

  it("places unlisted keys last, preserving their natural order", () => {
    expect(applyOrder(items, key, ["c"]).map(key)).toEqual(["c", "a", "b"]);
  });
});

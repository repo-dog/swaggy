import { describe, it, expect } from "vitest";
import { sortByFrequency } from "../../src/features/palette/frequency.js";

const ops = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("sortByFrequency", () => {
  it("orders by count descending", () => {
    expect(sortByFrequency(ops, { a: 1, b: 5, c: 2 }).map((o) => o.id)).toEqual(["b", "c", "a"]);
  });

  it("keeps original order for equal (and zero) counts", () => {
    expect(sortByFrequency(ops, {}).map((o) => o.id)).toEqual(["a", "b", "c"]);
    expect(sortByFrequency(ops, { a: 2, c: 2 }).map((o) => o.id)).toEqual(["a", "c", "b"]);
  });

  it("does not mutate the input", () => {
    const input = [...ops];
    sortByFrequency(input, { c: 9 });
    expect(input.map((o) => o.id)).toEqual(["a", "b", "c"]);
  });
});

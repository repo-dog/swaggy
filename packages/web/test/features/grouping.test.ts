import { describe, it, expect } from "vitest";
import { groupOperations } from "../../src/features/operations/grouping.js";
import type { Operation } from "@swaggy/shared";

const op = (id: string, tags: string[]): Operation => ({
  id, specId: "s", specTitle: "S", method: "GET", path: "/" + id, summary: "", description: "",
  tags, servers: [], pathParams: [], queryParams: [], headerParams: [], requestBody: null, responses: [],
});

describe("groupOperations", () => {
  it("groups by tag, sorted alphabetically", () => {
    const groups = groupOperations([op("a", ["Users"]), op("b", ["Accounts"])]);
    expect(groups.map((g) => g.tag)).toEqual(["Accounts", "Users"]);
  });

  it("places an operation under each of its tags", () => {
    const groups = groupOperations([op("a", ["Users", "Admin"])]);
    expect(groups.find((g) => g.tag === "Users")!.ops.map((o) => o.id)).toEqual(["a"]);
    expect(groups.find((g) => g.tag === "Admin")!.ops.map((o) => o.id)).toEqual(["a"]);
  });

  it("puts untagged operations in a default group, sorted last", () => {
    const groups = groupOperations([op("a", []), op("b", ["Users"])]);
    expect(groups.map((g) => g.tag)).toEqual(["Users", "default"]);
    expect(groups.find((g) => g.tag === "default")!.ops.map((o) => o.id)).toEqual(["a"]);
  });

  it("preserves operation order within a group", () => {
    const groups = groupOperations([op("b", ["T"]), op("a", ["T"])]);
    expect(groups[0].ops.map((o) => o.id)).toEqual(["b", "a"]);
  });
});

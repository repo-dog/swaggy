import { describe, it, expect } from "vitest";
import { searchOperations, fuzzyMatchIds } from "../../src/hooks/useSearch.js";
import type { Operation } from "@swaggy/shared";

const op = (over: Partial<Operation>): Operation => ({
  id: "x", specId: "s", specTitle: "S", method: "GET", path: "/x", summary: "", description: "",
  tags: [], servers: ["https://a"], pathParams: [], queryParams: [], headerParams: [],
  requestBody: null, responses: [], ...over,
});

const ops = [
  op({ id: "users:getUser", method: "GET", path: "/users/{id}", summary: "Get a user", tags: ["users"] }),
  op({ id: "orders:createOrder", method: "POST", path: "/orders", summary: "Create order", tags: ["orders"] }),
];

describe("searchOperations", () => {
  it("returns all when query is empty", () => {
    expect(searchOperations(ops, "")).toHaveLength(2);
  });
  it("matches on path", () => {
    expect(searchOperations(ops, "users").map((o) => o.id)).toContain("users:getUser");
  });
  it("matches on summary fuzzily", () => {
    expect(searchOperations(ops, "creat order").map((o) => o.id)).toContain("orders:createOrder");
  });
  it("matches on tag", () => {
    expect(searchOperations(ops, "orders").map((o) => o.id)).toContain("orders:createOrder");
  });
});

describe("fuzzyMatchIds", () => {
  it("is empty for an empty query", () => {
    expect(fuzzyMatchIds(ops, " ").size).toBe(0);
  });
  it("tolerates a typo", () => {
    expect(fuzzyMatchIds(ops, "ordres").has("orders:createOrder")).toBe(true);
  });
  it("does not match unrelated text", () => {
    expect(fuzzyMatchIds(ops, "zzzzqq").size).toBe(0);
  });
});

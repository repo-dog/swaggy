import { describe, it, expect } from "vitest";
import { filterHistory } from "../../src/features/history/filterHistory.js";
import type { HistoryEntry } from "../../src/store/store.types.js";

const entry = (over: Partial<HistoryEntry>): HistoryEntry => ({
  id: "1", operationId: "users:getUser", timestamp: 1, durationMs: 1,
  request: { server: "https://a", pathParams: {}, query: {}, headers: {} },
  response: { status: 200, headers: {}, body: {}, bodyTruncated: false }, ...over,
});

describe("filterHistory", () => {
  const items = [entry({ id: "1", operationId: "users:getUser", response: { status: 200, headers: {}, body: {}, bodyTruncated: false } }),
                 entry({ id: "2", operationId: "orders:create", response: { status: 500, headers: {}, body: {}, bodyTruncated: false } })];
  it("returns all for an empty query", () => { expect(filterHistory(items, "")).toHaveLength(2); });
  it("matches on operationId", () => { expect(filterHistory(items, "orders").map((e) => e.id)).toEqual(["2"]); });
  it("matches on status", () => { expect(filterHistory(items, "500").map((e) => e.id)).toEqual(["2"]); });
  it("matches on the resolved path/summary (what the panel shows)", () => {
    const resolve = (id: string) =>
      id === "users:getUser" ? { path: "/users/{id}", summary: "Fetch a user" } : undefined;
    expect(filterHistory(items, "/users", resolve).map((e) => e.id)).toEqual(["1"]);
    expect(filterHistory(items, "fetch a user", resolve).map((e) => e.id)).toEqual(["1"]);
  });
});

import { describe, it, expect } from "vitest";
import { reconcileBookmarks } from "../../src/features/operations/reconcile.js";
import type { Operation } from "@swaggy/shared";

const op = (id: string): Operation => ({ id, specId: "s", specTitle: "S", method: "GET", path: "/" + id, summary: "", description: "", tags: [], servers: [], pathParams: [], queryParams: [], headerParams: [], requestBody: null, responses: [] });

describe("reconcileBookmarks", () => {
  it("splits available operations from missing ids", () => {
    const ops = [op("a"), op("b")];
    const r = reconcileBookmarks(["a", "gone"], ops);
    expect(r.available.map((o) => o.id)).toEqual(["a"]);
    expect(r.missingIds).toEqual(["gone"]);
  });
});

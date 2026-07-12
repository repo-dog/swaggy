import { describe, it, expect, vi, afterEach } from "vitest";
import { getSpecs, sendProxy } from "../../src/lib/api.js";
import type { ProxyRequest } from "@swaggy/shared";

const req: ProxyRequest = {
  operationId: "u:p", server: "https://a.com", method: "GET", path: "/p",
  pathParams: {}, query: {}, headers: {},
};

afterEach(() => vi.restoreAllMocks());

describe("api client", () => {
  it("getSpecs parses JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ specId: "u", title: "U", version: "1", serverUrls: [], operationCount: 0, lastRefreshedAt: null, status: "ok" }]), { status: 200 }),
    ));
    const specs = await getSpecs();
    expect(specs[0].specId).toBe("u");
  });

  it("sendProxy returns ok on 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 200, statusText: "", headers: {}, body: {}, durationMs: 1, bodySize: 2 }), { status: 200 }),
    ));
    const r = await sendProxy(req);
    expect(r.ok).toBe(true);
  });

  it("sendProxy returns error on 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { kind: "connection", message: "refused" } }), { status: 502 }),
    ));
    const r = await sendProxy(req);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.error.kind).toBe("connection");
  });
});

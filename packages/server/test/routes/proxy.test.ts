import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MockAgent, setGlobalDispatcher } from "undici";
import { buildApp } from "../../src/app.js";
import { SpecRegistry } from "../../src/services/spec-registry.js";
import type { Config } from "@swaggy/shared";

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const config: Config = {
  refreshIntervalMs: 300000, proxyTimeoutMs: 30000,
  specs: [{ name: "users", url: "https://x/u.json", defaultServer: null }],
};
const doc = {
  openapi: "3.0.0", info: { title: "Users", version: "1.0.0" },
  servers: [{ url: "https://api.example.com" }],
  paths: { "/ping": { get: { operationId: "ping", responses: { "200": { description: "ok" } } } } },
};

async function appWithSpec() {
  const registry = new SpecRegistry(config, { fetchSpec: vi.fn().mockResolvedValue(doc), logger });
  await registry.refreshAll();
  return buildApp({ registry });
}

describe("proxy route", () => {
  it("POST /api/proxy with an invalid body returns 400", async () => {
    const app = await appWithSpec();
    const res = await app.inject({
      method: "POST",
      url: "/api/proxy",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("multipart proxy route", () => {
  let agent: MockAgent;
  beforeEach(() => { agent = new MockAgent(); agent.disableNetConnect(); setGlobalDispatcher(agent); });
  afterEach(async () => { await agent.close(); });

  it("rejects a non-multipart POST with 400", async () => {
    const app = await appWithSpec();
    const res = await app.inject({ method: "POST", url: "/api/proxy/multipart", payload: { a: 1 } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/multipart/i);
  });

  it("parses __meta + a file part and forwards a real multipart body upstream", async () => {
    let upstreamCt = "";
    agent.get("https://api.example.com").intercept({ path: "/upload", method: "POST" })
      .reply((opts) => {
        upstreamCt = String((opts.headers as Record<string, unknown>)["content-type"] ?? "");
        return { statusCode: 201, data: JSON.stringify({ ok: true }), responseOptions: { headers: { "content-type": "application/json" } } };
      });
    const meta = { operationId: "ping", server: "https://api.example.com", method: "POST", path: "/upload", pathParams: {}, query: {}, headers: {} };
    const boundary = "----swaggytestboundary";
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="__meta"',
      "",
      JSON.stringify(meta),
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="a.txt"',
      "Content-Type: text/plain",
      "",
      "hello world",
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const app = await appWithSpec();
    const res = await app.inject({
      method: "POST",
      url: "/api/proxy/multipart",
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 201, body: { ok: true } });
    expect(upstreamCt).toMatch(/^multipart\/form-data; boundary=/);
  });
});

import { describe, it, expect, vi } from "vitest";
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

describe("specs routes", () => {
  it("GET /api/specs returns metadata", async () => {
    const app = await appWithSpec();
    const res = await app.inject({ method: "GET", url: "/api/specs" });
    expect(res.statusCode).toBe(200);
    expect(res.json()[0]).toMatchObject({ specId: "users", status: "ok", operationCount: 1 });
  });

  it("GET /api/operations returns all operations", async () => {
    const app = await appWithSpec();
    const res = await app.inject({ method: "GET", url: "/api/operations" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].id).toBe("users:ping");
  });

  it("GET /api/operations?specId filters", async () => {
    const app = await appWithSpec();
    const res = await app.inject({ method: "GET", url: "/api/operations?specId=nope" });
    expect(res.json()).toHaveLength(0);
  });

  it("GET /api/health reports ok + spec count", async () => {
    const app = await appWithSpec();
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", specs: 1 });
  });
});

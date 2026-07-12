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

describe("refresh route", () => {
  it("POST /api/refresh triggers a reload and returns refreshed:true", async () => {
    const fetchSpec = vi.fn().mockResolvedValue(doc);
    const registry = new SpecRegistry(config, { fetchSpec, logger });
    const app = buildApp({ registry });
    const res = await app.inject({ method: "POST", url: "/api/refresh" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ refreshed: true });
    expect(fetchSpec).toHaveBeenCalledTimes(1);
  });
});

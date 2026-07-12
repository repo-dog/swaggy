import { describe, it, expect, vi } from "vitest";
import { SpecRegistry } from "../../src/services/spec-registry.js";
import type { Config } from "@swaggy/shared";

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function docFor(title: string, opId: string) {
  return {
    openapi: "3.0.0",
    info: { title, version: "1.0.0" },
    servers: [{ url: "https://api.example.com" }],
    paths: { "/ping": { get: { operationId: opId, responses: { "200": { description: "ok" } } } } },
  };
}

const config: Config = {
  refreshIntervalMs: 300000,
  proxyTimeoutMs: 30000,
  specs: [{ name: "users", url: "https://x/users.json", defaultServer: null }],
};

describe("SpecRegistry", () => {
  it("loads a spec and exposes operations + ok status", async () => {
    const fetchSpec = vi.fn().mockResolvedValue(docFor("Users", "ping"));
    const reg = new SpecRegistry(config, { fetchSpec, logger });
    await reg.refreshAll();
    expect(reg.getSpecs()[0].status).toBe("ok");
    expect(reg.getOperations()).toHaveLength(1);
    expect(reg.getOperations()[0].id).toBe("users:ping");
  });

  it("marks error when a spec never loads", async () => {
    const fetchSpec = vi.fn().mockRejectedValue(new Error("boom"));
    const reg = new SpecRegistry(config, { fetchSpec, logger });
    await reg.refreshAll();
    expect(reg.getSpecs()[0].status).toBe("error");
    expect(reg.getOperations()).toHaveLength(0);
  });

  it("keeps last-good and marks stale when a refresh fails", async () => {
    const fetchSpec = vi
      .fn()
      .mockResolvedValueOnce(docFor("Users", "ping"))
      .mockRejectedValueOnce(new Error("upstream down"));
    const reg = new SpecRegistry(config, { fetchSpec, logger });
    await reg.refreshAll(); // ok
    await reg.refreshAll(); // fails
    expect(reg.getSpecs()[0].status).toBe("stale");
    expect(reg.getOperations()).toHaveLength(1); // last-good retained
  });

  it("collects allowed hosts from resolved servers", async () => {
    const fetchSpec = vi.fn().mockResolvedValue(docFor("Users", "ping"));
    const reg = new SpecRegistry(config, { fetchSpec, logger });
    await reg.refreshAll();
    expect(reg.getAllowedHosts().has("api.example.com")).toBe(true);
  });
});

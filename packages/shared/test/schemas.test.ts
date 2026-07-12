import { describe, it, expect } from "vitest";
import { ConfigSchema, ProxyRequestSchema, OperationSchema } from "../src/schemas.js";

describe("ConfigSchema", () => {
  it("applies defaults for intervals", () => {
    const cfg = ConfigSchema.parse({ specs: [{ name: "users", url: "https://x/o.json" }] });
    expect(cfg.refreshIntervalMs).toBe(300000);
    expect(cfg.proxyTimeoutMs).toBe(30000);
    expect(cfg.specs[0].defaultServer).toBeNull();
  });

  it("rejects a spec with no name", () => {
    expect(() => ConfigSchema.parse({ specs: [{ url: "https://x/o.json" }] })).toThrow();
  });
});

describe("ProxyRequestSchema", () => {
  it("requires operationId, server, method, path", () => {
    expect(() => ProxyRequestSchema.parse({ method: "GET" })).toThrow();
  });
});

describe("OperationSchema", () => {
  it("accepts a minimal operation", () => {
    const op = OperationSchema.parse({
      id: "users:GET:/u", specId: "users", specTitle: "Users", method: "GET", path: "/u",
      summary: "", description: "", tags: [], servers: ["https://x"],
      pathParams: [], queryParams: [], headerParams: [], requestBody: null, responses: [],
    });
    expect(op.id).toBe("users:GET:/u");
  });
});

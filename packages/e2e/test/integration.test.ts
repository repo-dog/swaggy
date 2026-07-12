import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../server/src/app.js";
import { SpecRegistry } from "../../server/src/services/spec-registry.js";
import { fetchDereferencedSpec } from "../../server/src/services/fetch-spec.js";
import { startMockBackend, MOCK_PORT, MOCK_URL } from "../src/mock-backend.js";
import type { Config } from "@swaggy/shared";

const here = dirname(fileURLToPath(import.meta.url));
const specPath = (f: string) => join(here, "..", "specs", f);

const config: Config = {
  refreshIntervalMs: 300000,
  proxyTimeoutMs: 10000,
  specs: [
    { name: "swagger-2.0", url: specPath("kitchen-sink-2.0.json"), defaultServer: null },
    { name: "openapi-3.0", url: specPath("kitchen-sink-3.0.json"), defaultServer: null },
    { name: "openapi-3.1", url: specPath("kitchen-sink-3.1.json"), defaultServer: null },
  ],
};
// Quiet logger for the registry; buildApp gets its own default.
const logger = { info() {}, warn() {}, error() {}, debug() {}, fatal() {}, trace() {}, child: () => logger } as never;

let mock: FastifyInstance;
let app: FastifyInstance;
let registry: SpecRegistry;

beforeAll(async () => {
  mock = await startMockBackend(MOCK_PORT);
  registry = new SpecRegistry(config, { fetchSpec: fetchDereferencedSpec, logger });
  await registry.refreshAll();
  app = buildApp({ registry, proxyTimeoutMs: 10000, logger });
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await mock.close();
});

// POST a ProxyRequest through the real proxy to the mock backend.
const proxy = (over: Record<string, unknown>) =>
  app.inject({
    method: "POST",
    url: "/api/proxy",
    payload: { operationId: "op", server: MOCK_URL, method: "GET", path: "/anything", pathParams: {}, query: {}, headers: {}, ...over },
  });

describe("spec loading (2.0 / 3.0 / 3.1)", () => {
  it("loads all three specs without errors", async () => {
    const specs = (await app.inject({ method: "GET", url: "/api/specs" })).json();
    expect(specs.map((s: { specId: string }) => s.specId).sort()).toEqual(["openapi-3.0", "openapi-3.1", "swagger-2.0"]);
    expect(specs.every((s: { status: string }) => s.status !== "error")).toBe(true);
  });

  it("normalizes 3.0 security schemes, templated servers, and component schemas", async () => {
    const specs = (await app.inject({ method: "GET", url: "/api/specs" })).json();
    const v3 = specs.find((s: { specId: string }) => s.specId === "openapi-3.0");
    const schemeTypes = (v3.securitySchemes ?? []).map((s: { type: string }) => s.type);
    expect(schemeTypes).toEqual(expect.arrayContaining(["apiKey", "http", "oauth2", "openIdConnect"]));
    expect((v3.serverDefs ?? []).some((d: { variables?: unknown }) => d.variables)).toBe(true);
    expect((v3.schemas ?? []).map((s: { name: string }) => s.name)).toEqual(expect.arrayContaining(["Node", "Pet"]));
  });

  it("exposes normalized operations incl. form bodies, deprecated, and per-op security", async () => {
    const ops = (await app.inject({ method: "GET", url: "/api/operations" })).json();
    const byPath = (path: string, method: string) => ops.find((o: { path: string; method: string }) => o.path === path && o.method === method.toUpperCase());
    expect(byPath("/upload", "post").requestBody.contentType).toBe("multipart/form-data");
    expect(byPath("/form", "post").requestBody.contentType).toBe("application/x-www-form-urlencoded");
    expect(byPath("/anything", "post").deprecated).toBe(true);
    expect(byPath("/secure/basic", "get").security.length).toBeGreaterThan(0);
    // Swagger 2.0 formData file upload becomes a multipart body too.
    expect(ops.some((o: { path: string; requestBody?: { contentType?: string } }) => o.path === "/upload" && o.requestBody?.contentType === "multipart/form-data")).toBe(true);
  });
});

describe("proxy: params & echo", () => {
  it("forwards query params (incl. arrays) to the backend", async () => {
    const res = await proxy({ query: { status: "open", tags: ["a", "b"] } });
    expect(res.statusCode).toBe(200);
    expect(res.json().body.query).toMatchObject({ status: "open", tags: ["a", "b"] });
  });

  it("substitutes path params", async () => {
    const res = await proxy({ path: "/users/{id}", pathParams: { id: "42" } });
    expect(res.json().body.id).toBe("42");
  });

  it("forwards custom headers", async () => {
    const res = await proxy({ headers: { "X-Trace": "abc123" } });
    expect(res.json().body.headers["x-trace"]).toBe("abc123");
  });
});

describe("proxy: request bodies", () => {
  it("sends a JSON body and parses the JSON response", async () => {
    const res = await proxy({ method: "POST", path: "/json", body: { pet: { kind: "cat", purrs: true } } });
    expect(res.json().body.received).toEqual({ pet: { kind: "cat", purrs: true } });
  });

  it("sends an x-www-form-urlencoded string body verbatim", async () => {
    const res = await proxy({ method: "POST", path: "/form", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "name=alice&agree=true" });
    expect(res.json().body.form).toMatchObject({ name: "alice", agree: "true" });
  });
});

describe("proxy: multipart upload (Option B)", () => {
  it("forwards a real multipart body with a file part", async () => {
    const boundary = "----e2eboundary";
    const meta = { operationId: "uploadFile", server: MOCK_URL, method: "POST", path: "/upload", pathParams: {}, query: {}, headers: {} };
    const payload = [
      `--${boundary}`, 'Content-Disposition: form-data; name="__meta"', "", JSON.stringify(meta),
      `--${boundary}`, 'Content-Disposition: form-data; name="caption"', "", "hi there",
      `--${boundary}`, 'Content-Disposition: form-data; name="file"; filename="a.txt"', "Content-Type: text/plain", "", "hello world",
      `--${boundary}--`, "",
    ].join("\r\n");
    const res = await app.inject({ method: "POST", url: "/api/proxy/multipart", headers: { "content-type": `multipart/form-data; boundary=${boundary}` }, payload });
    expect(res.statusCode).toBe(200);
    const body = res.json().body;
    expect(body.fields).toMatchObject({ caption: "hi there" });
    expect(body.files).toEqual([{ field: "file", filename: "a.txt", mimetype: "text/plain", size: 11 }]);
  });
});

describe("proxy: responses", () => {
  it("passes through a chosen status code", async () => {
    expect((await proxy({ path: "/status/503", pathParams: { code: "503" } })).json().status).toBe(503);
  });

  it("surfaces a redirect Location without following it", async () => {
    const res = await proxy({ path: "/redirect" });
    const r = res.json();
    expect(r.status).toBe(302);
    expect(r.headers.location).toContain("/anything");
  });

  it("parses JSON but leaves XML/text raw, and handles 204", async () => {
    expect((await proxy({ path: "/content/json", pathParams: { kind: "json" } })).json().body).toEqual({ hello: "world" });
    expect(typeof (await proxy({ path: "/content/xml", pathParams: { kind: "xml" } })).json().body).toBe("string");
    expect((await proxy({ path: "/content/empty", pathParams: { kind: "empty" } })).json().status).toBe(204);
  });
});

describe("proxy: security", () => {
  it("401s without a key and 200s with the api key header", async () => {
    expect((await proxy({ path: "/secure/apikey" })).json().status).toBe(401);
    const ok = await proxy({ path: "/secure/apikey", headers: { "X-API-Key": "secret-key" } });
    expect(ok.json().body).toMatchObject({ authorized: true });
  });

  it("accepts a bearer token", async () => {
    const ok = await proxy({ path: "/secure/bearer", headers: { authorization: "Bearer xyz" } });
    expect(ok.json().body).toMatchObject({ authorized: true, via: "bearer" });
  });
});

describe("oauth token exchange", () => {
  it("proxies a client_credentials token request to the declared token host", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/oauth/token",
      payload: { tokenUrl: `${MOCK_URL}/oauth/token`, grantType: "client_credentials", clientId: "id", clientSecret: "sec", clientAuth: "body" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().access_token).toBe("test-token-client_credentials");
  });
});

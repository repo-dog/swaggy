import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MockAgent, setGlobalDispatcher } from "undici";
import { buildTargetUrl, executeProxy, executeMultipartProxy, isJsonContentType } from "../../src/services/proxy.js";
import type { ProxyRequest, ProxyMultipartMeta } from "@swaggy/shared";

const base: ProxyRequest = {
  operationId: "users:getUser", server: "https://api.example.com", method: "GET",
  path: "/users/{id}", pathParams: { id: "42" }, query: { verbose: "true" }, headers: {},
};
const allowed = new Set(["api.example.com"]);

describe("buildTargetUrl", () => {
  it("substitutes path params and appends query", () => {
    expect(buildTargetUrl(base)).toBe("https://api.example.com/users/42?verbose=true");
  });
});

describe("isJsonContentType", () => {
  it("matches application/json and +json structured-syntax suffixes", () => {
    for (const ct of [
      "application/json",
      "application/json; charset=utf-8",
      "application/problem+json",
      "application/problem+json; charset=utf-8",
      "application/hal+json",
      "application/vnd.api+json",
      "application/ld+json",
      "text/json",
    ]) {
      expect(isJsonContentType(ct)).toBe(true);
    }
  });
  it("does not match non-JSON types", () => {
    for (const ct of ["text/plain", "application/xml", "text/html", ""]) {
      expect(isJsonContentType(ct)).toBe(false);
    }
  });
});

describe("executeProxy", () => {
  let agent: MockAgent;
  beforeEach(() => {
    agent = new MockAgent();
    agent.disableNetConnect();
    setGlobalDispatcher(agent);
  });
  afterEach(async () => { await agent.close(); });

  it("passes a target 500 through as an ok ProxyResponse", async () => {
    agent.get("https://api.example.com").intercept({ path: "/users/42?verbose=true", method: "GET" })
      .reply(500, { message: "kaboom" }, { headers: { "content-type": "application/json" } });
    const r = await executeProxy(base, { allowedHosts: allowed, timeoutMs: 5000 });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value.status).toBe(500); expect(r.value.body).toEqual({ message: "kaboom" }); }
  });

  it("returns 200 body and timing on success", async () => {
    agent.get("https://api.example.com").intercept({ path: "/users/42?verbose=true", method: "GET" })
      .reply(200, { id: "42" }, { headers: { "content-type": "application/json" } });
    const r = await executeProxy(base, { allowedHosts: allowed, timeoutMs: 5000 });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value.status).toBe(200); expect(typeof r.value.durationMs).toBe("number"); }
  });

  it("fills statusText with the standard reason phrase", async () => {
    agent.get("https://api.example.com").intercept({ path: "/users/42?verbose=true", method: "GET" })
      .reply(404, { message: "nope" }, { headers: { "content-type": "application/json" } });
    const r = await executeProxy(base, { allowedHosts: allowed, timeoutMs: 5000 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.statusText).toBe("Not Found");
  });

  it("returns raw text for non-JSON responses", async () => {
    agent.get("https://api.example.com").intercept({ path: "/users/42?verbose=true", method: "GET" })
      .reply(200, "plain text", { headers: { "content-type": "text/plain" } });
    const r = await executeProxy(base, { allowedHosts: allowed, timeoutMs: 5000 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.body).toBe("plain text");
  });

  it("parses a +json structured-syntax body (e.g. application/problem+json) into an object", async () => {
    agent.get("https://api.example.com").intercept({ path: "/users/42?verbose=true", method: "GET" })
      .reply(400, { type: "about:blank", title: "Bad Request", status: 400 }, { headers: { "content-type": "application/problem+json" } });
    const r = await executeProxy(base, { allowedHosts: allowed, timeoutMs: 5000 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.body).toEqual({ type: "about:blank", title: "Bad Request", status: 400 });
  });

  it("falls back to raw text when a JSON content-type carries a malformed body", async () => {
    agent.get("https://api.example.com").intercept({ path: "/users/42?verbose=true", method: "GET" })
      .reply(200, "{ not: valid json", { headers: { "content-type": "application/json" } });
    const r = await executeProxy(base, { allowedHosts: allowed, timeoutMs: 5000 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.body).toBe("{ not: valid json");
  });

  it("rejects a non-allowlisted host with 403", async () => {
    const r = await executeProxy({ ...base, server: "https://evil.com" }, { allowedHosts: allowed, timeoutMs: 5000 });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(403); expect(r.error.error.kind).toBe("forbidden"); }
  });

  it("rejects credentials embedded in the server URL", async () => {
    const r = await executeProxy({ ...base, server: "https://user:pass@api.example.com" }, { allowedHosts: allowed, timeoutMs: 5000 });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(400); expect(r.error.error.message).toMatch(/credentials/i); }
  });

  it("rejects a path that shifts the authority to a non-allowlisted host (userinfo smuggling)", async () => {
    // server host is allow-listed, but the crafted path turns it into userinfo for evil.com.
    const r = await executeProxy(
      { ...base, path: "@evil.com/x", pathParams: {}, query: {} },
      { allowedHosts: allowed, timeoutMs: 5000 },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("classifies upstream errors by undici error code (dns / timeout / connection)", async () => {
    const throwing = (code: string) => (async () => { throw Object.assign(new Error("boom"), { code }); }) as any;
    const dns = await executeProxy(base, { allowedHosts: allowed, timeoutMs: 5000, request: throwing("ENOTFOUND") });
    expect(dns.ok).toBe(false); if (!dns.ok) expect(dns.error.error.kind).toBe("dns");
    const to = await executeProxy(base, { allowedHosts: allowed, timeoutMs: 5000, request: throwing("UND_ERR_HEADERS_TIMEOUT") });
    expect(to.ok).toBe(false); if (!to.ok) expect(to.error.error.kind).toBe("timeout");
    const conn = await executeProxy(base, { allowedHosts: allowed, timeoutMs: 5000, request: throwing("ECONNREFUSED") });
    expect(conn.ok).toBe(false); if (!conn.ok) expect(conn.error.error.kind).toBe("connection");
  });

  it("returns 400 bad_request when server is not a valid URL", async () => {
    const r = await executeProxy({ ...base, server: "not a url" }, { allowedHosts: allowed, timeoutMs: 5000 });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(400); expect(r.error.error.kind).toBe("bad_request"); }
  });

  it("defaults content-type to application/json when body is present and client sends no content-type", async () => {
    agent.get("https://api.example.com").intercept({
      path: "/users/42?verbose=true", method: "POST",
      headers: (h) => h["content-type"] === "application/json",
    }).reply(200, {}, { headers: { "content-type": "application/json" } });
    const r = await executeProxy(
      { ...base, method: "POST", body: { a: 1 } },
      { allowedHosts: allowed, timeoutMs: 5000 },
    );
    expect(r.ok).toBe(true);
  });

  it("sends a string body verbatim (not JSON-encoded), defaulting content-type to text/plain", async () => {
    let seen: { body?: unknown; headers?: Record<string, unknown> } = {};
    agent.get("https://api.example.com").intercept({ path: "/users/42?verbose=true", method: "POST" })
      .reply((opts) => { seen = opts as typeof seen; return { statusCode: 200, data: "ok" }; });
    const r = await executeProxy({ ...base, method: "POST", body: "a=1&b=2" }, { allowedHosts: allowed, timeoutMs: 5000 });
    expect(r.ok).toBe(true);
    expect(seen.body).toBe("a=1&b=2");
    expect(seen.headers?.["content-type"]).toBe("text/plain");
  });

  it("keeps an explicit urlencoded content-type on a string body", async () => {
    let seen: { body?: unknown; headers?: Record<string, unknown> } = {};
    agent.get("https://api.example.com").intercept({ path: "/users/42?verbose=true", method: "POST" })
      .reply((opts) => { seen = opts as typeof seen; return { statusCode: 200, data: "ok" }; });
    await executeProxy(
      { ...base, method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "a=1" },
      { allowedHosts: allowed, timeoutMs: 5000 },
    );
    expect(seen.body).toBe("a=1");
    expect(seen.headers?.["content-type"]).toBe("application/x-www-form-urlencoded");
  });
});

describe("executeMultipartProxy", () => {
  let agent: MockAgent;
  beforeEach(() => { agent = new MockAgent(); agent.disableNetConnect(); setGlobalDispatcher(agent); });
  afterEach(async () => { await agent.close(); });

  const meta: ProxyMultipartMeta = {
    operationId: "files:upload", server: "https://api.example.com", method: "POST",
    path: "/upload", pathParams: {}, query: {}, headers: {},
  };

  it("rejects a non-allowlisted host with 403 before sending", async () => {
    const r = await executeMultipartProxy({ ...meta, server: "https://evil.com" }, [], { allowedHosts: allowed, timeoutMs: 5000 });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(403); expect(r.error.error.kind).toBe("forbidden"); }
  });

  it("forwards text + file parts as multipart/form-data and returns the upstream response", async () => {
    let ct = "";
    agent.get("https://api.example.com").intercept({ path: "/upload", method: "POST" })
      .reply((opts) => {
        ct = String((opts.headers as Record<string, unknown>)["content-type"] ?? "");
        return { statusCode: 201, data: JSON.stringify({ ok: true }), responseOptions: { headers: { "content-type": "application/json" } } };
      });
    const parts = [
      { name: "kind", data: Buffer.from("avatar") },
      { name: "file", data: Buffer.from("PNGDATA"), filename: "a.png", contentType: "image/png" },
    ];
    const r = await executeMultipartProxy(meta, parts, { allowedHosts: allowed, timeoutMs: 5000 });
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value.status).toBe(201); expect(r.value.body).toEqual({ ok: true }); }
    // fetch derives the multipart content-type (with a boundary) from the FormData.
    expect(ct).toMatch(/^multipart\/form-data; boundary=/);
  });
});

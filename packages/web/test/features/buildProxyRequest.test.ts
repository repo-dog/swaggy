import { describe, it, expect } from "vitest";
import { buildProxyRequest } from "../../src/features/request/buildProxyRequest.js";
import type { Operation } from "@swaggy/shared";

const op: Operation = {
  id: "users:getUser", specId: "users", specTitle: "Users", method: "GET", path: "/users/{id}",
  summary: "", description: "", tags: [], servers: ["https://a.com"],
  pathParams: [], queryParams: [], headerParams: [], requestBody: null, responses: [],
};
// An operation that declares an Authorization header parameter.
const opAuth: Operation = { ...op, headerParams: [{ name: "Authorization", in: "header", schema: { type: "string" }, required: false }] };

describe("buildProxyRequest", () => {
  it("carries operationId, method, path, and server", () => {
    const r = buildProxyRequest(op, { server: "https://a.com", pathParams: { id: "1" }, query: {}, headers: {} }, []);
    expect(r).toMatchObject({ operationId: "users:getUser", method: "GET", path: "/users/{id}", server: "https://a.com" });
    expect(r.pathParams.id).toBe("1");
  });

  it("applies a common header only when the operation declares it as a header param", () => {
    const r = buildProxyRequest(opAuth, { server: "https://a.com", pathParams: {}, query: {}, headers: {} }, [{ name: "Authorization", value: "Bearer t" }]);
    expect(r.headers.Authorization).toBe("Bearer t");
  });

  it("does NOT send a common header the operation doesn't declare", () => {
    const r = buildProxyRequest(op, { server: "https://a.com", pathParams: {}, query: {}, headers: {} }, [{ name: "Authorization", value: "Bearer t" }]);
    expect(r.headers.Authorization).toBeUndefined();
    expect(Object.keys(r.headers)).toHaveLength(0);
  });

  it("applies resolved auth headers unconditionally and merges auth query params", () => {
    const r = buildProxyRequest(
      op,
      { server: "https://a.com", pathParams: {}, query: { existing: "1" }, headers: {} },
      [],
      {},
      { headers: { Authorization: "Bearer t" }, query: { api_key: "k" } },
    );
    // Authorization applies even though the op doesn't declare it as a header param.
    expect(r.headers.Authorization).toBe("Bearer t");
    expect(r.query).toEqual({ existing: "1", api_key: "k" });
  });

  it("lets an explicit request header/query override a resolved auth value", () => {
    const r = buildProxyRequest(
      op,
      { server: "https://a.com", pathParams: {}, query: { api_key: "explicit" }, headers: { Authorization: "Bearer explicit" } },
      [],
      {},
      { headers: { Authorization: "Bearer auth" }, query: { api_key: "auth" } },
    );
    expect(r.headers.Authorization).toBe("Bearer explicit");
    expect(r.query.api_key).toBe("explicit");
  });

  it("does not send a disabled common header even when the operation declares it", () => {
    const r = buildProxyRequest(opAuth, { server: "https://a.com", pathParams: {}, query: {}, headers: {} }, [{ name: "Authorization", value: "Bearer t", enabled: false }]);
    expect(r.headers.Authorization).toBeUndefined();
  });

  it("still sends a common header whose enabled flag is unset (backward compatible)", () => {
    const r = buildProxyRequest(opAuth, { server: "https://a.com", pathParams: {}, query: {}, headers: {} }, [{ name: "Authorization", value: "Bearer t" }]);
    expect(r.headers.Authorization).toBe("Bearer t");
  });

  it("lets an explicit request header override a declared common header of the same name", () => {
    const r = buildProxyRequest(opAuth, { server: "https://a.com", pathParams: {}, query: {}, headers: { Authorization: "Bearer explicit" } }, [{ name: "Authorization", value: "Bearer auth" }]);
    expect(r.headers.Authorization).toBe("Bearer explicit");
  });

  it("omits empty auth header entries", () => {
    const r = buildProxyRequest(op, { server: "https://a.com", pathParams: {}, query: {}, headers: {} }, [{ name: "", value: "" }, { name: "X", value: "" }]);
    expect(Object.keys(r.headers)).toHaveLength(0);
  });

  it("cleans multi-value query params: drops empty entries and omits empty arrays", () => {
    const r = buildProxyRequest(
      op,
      { server: "https://a.com", pathParams: {}, query: { tags: ["x", "", "y"], none: [], scalar: "s" }, headers: {} },
      [],
    );
    expect(r.query).toEqual({ tags: ["x", "y"], scalar: "s" });
  });

  it("resolves {{variables}} across server, path, query, headers and body", () => {
    const r = buildProxyRequest(
      opAuth,
      {
        server: "https://{{host}}",
        pathParams: { id: "{{id}}" },
        query: { q: "{{id}}", tags: ["{{id}}", "lit"] },
        headers: { "X-Trace": "{{id}}" },
        body: { ref: "{{id}}", nested: { who: "{{host}}" } },
      },
      [{ name: "Authorization", value: "Bearer {{token}}" }],
      { host: "api.com", id: "42", token: "secret" },
    );
    expect(r.server).toBe("https://api.com");
    expect(r.pathParams.id).toBe("42");
    expect(r.query).toEqual({ q: "42", tags: ["42", "lit"] });
    expect(r.headers.Authorization).toBe("Bearer secret");
    expect(r.headers["X-Trace"]).toBe("42");
    expect(r.body).toEqual({ ref: "42", nested: { who: "api.com" } });
  });

  it("leaves an unknown {{reference}} untouched", () => {
    const r = buildProxyRequest(op, { server: "https://a.com", pathParams: { id: "{{missing}}" }, query: {}, headers: {} }, [], {});
    expect(r.pathParams.id).toBe("{{missing}}");
  });

  it("sends ad-hoc custom headers (any name), skipping empty-name rows and interpolating values", () => {
    const r = buildProxyRequest(
      op,
      { server: "https://a.com", pathParams: {}, query: {}, headers: {}, customHeaders: [{ name: "X-Custom", value: "{{token}}" }, { name: "  ", value: "ignored" }] },
      [],
      { token: "abc" },
    );
    expect(r.headers["X-Custom"]).toBe("abc");
    expect(Object.keys(r.headers)).toEqual(["X-Custom"]);
  });

  it("lets an explicit declared header input win over a same-named custom header", () => {
    const r = buildProxyRequest(
      opAuth,
      { server: "https://a.com", pathParams: {}, query: {}, headers: { Authorization: "Bearer declared" }, customHeaders: [{ name: "Authorization", value: "Bearer custom" }] },
      [],
    );
    expect(r.headers.Authorization).toBe("Bearer declared");
  });
});

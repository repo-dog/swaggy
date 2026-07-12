import { describe, it, expect } from "vitest";
import { resolveAuth } from "../../src/features/request/resolveAuth.js";
import type { Operation, SecurityScheme } from "@swaggy/shared";

const schemes: SecurityScheme[] = [
  { key: "bearerAuth", type: "http", scheme: "bearer" },
  { key: "basicAuth", type: "http", scheme: "basic" },
  { key: "apiKeyHeader", type: "apiKey", in: "header", paramName: "X-API-Key" },
  { key: "apiKeyQuery", type: "apiKey", in: "query", paramName: "api_key" },
  { key: "oauth", type: "oauth2", flows: {} },
];
const op = (keys: string[]): Pick<Operation, "security"> => ({ security: [Object.fromEntries(keys.map((k) => [k, []]))] });

describe("resolveAuth", () => {
  it("bearer → Authorization: Bearer", () => {
    const { headers } = resolveAuth(op(["bearerAuth"]), schemes, { bearerAuth: { value: "tok" } });
    expect(headers.Authorization).toBe("Bearer tok");
  });

  it("basic → Authorization: Basic base64(user:pass)", () => {
    const { headers } = resolveAuth(op(["basicAuth"]), schemes, { basicAuth: { username: "u", password: "p" } });
    expect(headers.Authorization).toBe(`Basic ${btoa("u:p")}`);
  });

  it("apiKey in header and query go to the right place", () => {
    expect(resolveAuth(op(["apiKeyHeader"]), schemes, { apiKeyHeader: { value: "k" } }).headers["X-API-Key"]).toBe("k");
    expect(resolveAuth(op(["apiKeyQuery"]), schemes, { apiKeyQuery: { value: "k" } }).query["api_key"]).toBe("k");
  });

  it("oauth2 access token → bearer", () => {
    expect(resolveAuth(op(["oauth"]), schemes, { oauth: { value: "at" } }).headers.Authorization).toBe("Bearer at");
  });

  it("applies exactly one OR-alternative, not the union of all schemes", () => {
    // Two alternatives: {bearerAuth} OR {apiKeyHeader}. Only apiKeyHeader has a credential,
    // so only that alternative is applied — no bearer header leaks in.
    const twoAlternatives: Pick<Operation, "security"> = { security: [{ bearerAuth: [] }, { apiKeyHeader: [] }] };
    const out = resolveAuth(twoAlternatives, schemes, { apiKeyHeader: { value: "k" }, bearerAuth: { value: "t" } });
    // The first FULLY-satisfied alternative is chosen; both have creds here, so the first
    // ({bearerAuth}) wins and apiKey is NOT also applied.
    expect(out.headers.Authorization).toBe("Bearer t");
    expect(out.headers["X-API-Key"]).toBeUndefined();
  });

  it("falls to the satisfiable alternative when the first isn't filled in", () => {
    const twoAlternatives: Pick<Operation, "security"> = { security: [{ bearerAuth: [] }, { apiKeyHeader: [] }] };
    const out = resolveAuth(twoAlternatives, schemes, { apiKeyHeader: { value: "k" } });
    expect(out.headers["X-API-Key"]).toBe("k");
    expect(out.headers.Authorization).toBeUndefined();
  });

  it("applies nothing when the op requires no matching scheme, or no credential is set", () => {
    expect(resolveAuth(op(["bearerAuth"]), schemes, {})).toEqual({ headers: {}, query: {} });
    expect(resolveAuth({ security: undefined }, schemes, { bearerAuth: { value: "t" } })).toEqual({ headers: {}, query: {} });
    // A scheme the op doesn't reference is not applied even if a credential exists.
    expect(resolveAuth(op(["bearerAuth"]), schemes, { apiKeyHeader: { value: "k" } }).headers).toEqual({});
  });
});

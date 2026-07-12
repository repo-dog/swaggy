import { describe, it, expect } from "vitest";
import { toCurl } from "../../src/features/response/copyAsCurl.js";
import type { ProxyRequest } from "@swaggy/shared";

const req: ProxyRequest = {
  operationId: "users:getUser", server: "https://a.com", method: "POST", path: "/users/{id}",
  pathParams: { id: "42" }, query: { verbose: "true" },
  headers: { Authorization: "Bearer t" }, body: { name: "x" },
};

describe("toCurl", () => {
  it("includes method, resolved URL, header, and JSON body", () => {
    const c = toCurl(req);
    expect(c).toContain("curl -X POST");
    expect(c).toContain("https://a.com/users/42?verbose=true");
    expect(c).toContain("-H 'Authorization: Bearer t'");
    expect(c).toContain(`-d '{"name":"x"}'`);
  });

  it("omits -d for a GET with no body", () => {
    const c = toCurl({ ...req, method: "GET", body: undefined });
    expect(c).not.toContain("-d ");
  });
});

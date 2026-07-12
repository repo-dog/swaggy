import { describe, it, expect } from "vitest";
import { buildAuthorizeUrl, randomString, pkceChallenge } from "../../src/features/request/oauth.js";

describe("buildAuthorizeUrl", () => {
  it("builds an authorization_code URL with PKCE params", () => {
    const url = new URL(
      buildAuthorizeUrl("https://idp.test/authorize", {
        clientId: "cid", redirectUri: "https://app.test/oauth-callback.html", scope: "read write", state: "xyz", responseType: "code", codeChallenge: "chal",
      }),
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.test/oauth-callback.html");
    expect(url.searchParams.get("scope")).toBe("read write");
    expect(url.searchParams.get("state")).toBe("xyz");
    expect(url.searchParams.get("code_challenge")).toBe("chal");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("omits PKCE params for the implicit flow", () => {
    const url = new URL(
      buildAuthorizeUrl("https://idp.test/authorize", { clientId: "cid", redirectUri: "https://app.test/cb", state: "s", responseType: "token" }),
    );
    expect(url.searchParams.get("response_type")).toBe("token");
    expect(url.searchParams.get("code_challenge")).toBeNull();
  });

  it("preserves existing query params on the authorization URL", () => {
    const url = new URL(buildAuthorizeUrl("https://idp.test/authorize?audience=api", { clientId: "c", redirectUri: "https://a/cb", state: "s", responseType: "code" }));
    expect(url.searchParams.get("audience")).toBe("api");
    expect(url.searchParams.get("client_id")).toBe("c");
  });
});

describe("PKCE helpers", () => {
  it("randomString is URL-safe and non-repeating", () => {
    const a = randomString(32);
    const b = randomString(32);
    expect(a).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(a).not.toBe(b);
  });

  it("pkceChallenge is a stable S256 digest of the verifier", async () => {
    const c1 = await pkceChallenge("verifier123");
    const c2 = await pkceChallenge("verifier123");
    expect(c1).toBe(c2);
    expect(c1).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(c1).not.toContain("=");
  });
});

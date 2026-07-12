import { describe, it, expect } from "vitest";
import { buildTokenForm, requestOAuthToken } from "../../src/services/oauth.js";

describe("buildTokenForm", () => {
  it("client_credentials with client_secret_post puts credentials in the body", () => {
    const { body, headers } = buildTokenForm({
      tokenUrl: "https://a/token", grantType: "client_credentials", clientId: "id", clientSecret: "sec", scope: "read write", clientAuth: "body",
    });
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("client_id")).toBe("id");
    expect(body.get("client_secret")).toBe("sec");
    expect(body.get("scope")).toBe("read write");
    expect(headers.authorization).toBeUndefined();
  });

  it("client_secret_basic puts credentials in a Basic Authorization header", () => {
    const { body, headers } = buildTokenForm({
      tokenUrl: "https://a/token", grantType: "client_credentials", clientId: "id", clientSecret: "sec", clientAuth: "basic",
    });
    expect(headers.authorization).toBe(`Basic ${Buffer.from("id:sec").toString("base64")}`);
    expect(body.get("client_id")).toBeNull();
  });

  it("password grant carries username/password", () => {
    const { body } = buildTokenForm({ tokenUrl: "https://a/token", grantType: "password", username: "u", password: "p", clientAuth: "body" });
    expect(body.get("grant_type")).toBe("password");
    expect(body.get("username")).toBe("u");
    expect(body.get("password")).toBe("p");
  });

  it("authorization_code carries code, redirect_uri, and PKCE verifier", () => {
    const { body } = buildTokenForm({
      tokenUrl: "https://a/token", grantType: "authorization_code", code: "abc", redirectUri: "https://app/cb", codeVerifier: "ver", clientAuth: "body",
    });
    expect(body.get("code")).toBe("abc");
    expect(body.get("redirect_uri")).toBe("https://app/cb");
    expect(body.get("code_verifier")).toBe("ver");
  });
});

describe("requestOAuthToken host allow-list (SSRF guard)", () => {
  const opts = { timeoutMs: 1000, allowedHosts: new Set(["idp.example.com"]) };

  it("rejects a token URL whose host isn't allow-listed, without making a request", async () => {
    const r = await requestOAuthToken(
      { tokenUrl: "http://169.254.169.254/latest/token", grantType: "client_credentials", clientAuth: "body" },
      opts,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(403); expect(r.error.kind).toBe("forbidden"); }
  });

  it("rejects a token URL carrying userinfo", async () => {
    const r = await requestOAuthToken(
      { tokenUrl: "https://user:pass@idp.example.com/token", grantType: "client_credentials", clientAuth: "body" },
      opts,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });
});

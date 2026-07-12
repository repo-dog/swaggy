import type { OAuthTokenRequest } from "@swaggy/shared";

export type OAuthTokenOutcome =
  | { ok: true; token: Record<string, unknown> }
  | { ok: false; status: number; error: { kind: string; message: string } };

/** Build the form body + headers for an OAuth2 token request, per grant type and client-auth
 * style. Pure, so the request shaping is unit-testable without a network call. */
export function buildTokenForm(input: OAuthTokenRequest): { body: URLSearchParams; headers: Record<string, string> } {
  const body = new URLSearchParams();
  body.set("grant_type", input.grantType);
  if (input.scope) body.set("scope", input.scope);
  if (input.grantType === "password") {
    if (input.username) body.set("username", input.username);
    if (input.password) body.set("password", input.password);
  }
  if (input.grantType === "authorization_code") {
    if (input.code) body.set("code", input.code);
    if (input.redirectUri) body.set("redirect_uri", input.redirectUri);
    if (input.codeVerifier) body.set("code_verifier", input.codeVerifier);
  }
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    accept: "application/json",
  };
  if (input.clientAuth === "basic" && input.clientId) {
    const creds = Buffer.from(`${input.clientId}:${input.clientSecret ?? ""}`).toString("base64");
    headers["authorization"] = `Basic ${creds}`;
  } else {
    // client_secret_post: credentials go in the body.
    if (input.clientId) body.set("client_id", input.clientId);
    if (input.clientSecret) body.set("client_secret", input.clientSecret);
  }
  return { body, headers };
}

/** Perform an OAuth2 token request against the provider's token endpoint. `allowedHosts`
 * restricts which hosts may be contacted (the token/refresh URLs declared by loaded specs),
 * so this endpoint can't be used as an open relay / SSRF vector. */
export async function requestOAuthToken(
  input: OAuthTokenRequest,
  opts: { timeoutMs: number; allowedHosts: Set<string> },
): Promise<OAuthTokenOutcome> {
  let host: string;
  try {
    const u = new URL(input.tokenUrl);
    if (u.username || u.password) throw new Error("userinfo");
    host = u.host;
  } catch {
    return { ok: false, status: 400, error: { kind: "bad_request", message: "Invalid token URL" } };
  }
  if (!opts.allowedHosts.has(host)) {
    return { ok: false, status: 403, error: { kind: "forbidden", message: `Token host not allowed: ${host}` } };
  }
  const { body, headers } = buildTokenForm(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    // redirect: "manual" — a token endpoint must not 3xx us (with credentials) to another host.
    const res = await fetch(input.tokenUrl, { method: "POST", headers, body, redirect: "manual", signal: controller.signal });
    const text = await res.text();
    let json: Record<string, unknown>;
    try {
      const parsed = JSON.parse(text);
      json = parsed !== null && typeof parsed === "object" ? parsed : { raw: text };
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      const message = typeof json.error_description === "string" ? json.error_description : typeof json.error === "string" ? json.error : `Token endpoint returned ${res.status}`;
      return { ok: false, status: 400, error: { kind: "bad_request", message } };
    }
    return { ok: true, token: json };
  } catch (err) {
    const aborted = (err as Error)?.name === "AbortError";
    return {
      ok: false,
      status: aborted ? 504 : 502,
      error: { kind: aborted ? "timeout" : "connection", message: (err as Error)?.message ?? "Token request failed" },
    };
  } finally {
    clearTimeout(timer);
  }
}

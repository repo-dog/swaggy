import type { OAuthTokenRequest } from "@swaggy/shared";

/** Exchange OAuth2 credentials for a token via the server proxy. Returns the token response
 * (access_token, token_type, …) or throws with the provider's error message. */
export async function requestToken(input: OAuthTokenRequest): Promise<Record<string, unknown>> {
  const res = await fetch("/api/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as any)?.error?.message ?? `Token request failed (${res.status})`);
  return json as Record<string, unknown>;
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A URL-safe random string for PKCE verifiers and CSRF `state`. */
export function randomString(bytes = 48): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return base64url(a);
}

/** The S256 PKCE code challenge for a verifier. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

/** The redirect URI the popup returns to; must be registered with the OAuth provider. */
export function oauthRedirectUri(): string {
  return `${window.location.origin}/oauth-callback.html`;
}

/** Run a redirect-based OAuth2 flow in a popup and resolve with the access token. For
 * authorization_code we generate PKCE and exchange the code via the server; for implicit the
 * token comes straight back on the callback hash. The callback page (public/oauth-callback.html)
 * postMessages the result back to us. */
export async function authorizeViaPopup(opts: {
  responseType: "code" | "token";
  authorizationUrl: string;
  tokenUrl?: string;
  clientId: string;
  clientSecret?: string;
  scope?: string;
}): Promise<string> {
  const redirectUri = oauthRedirectUri();
  const state = randomString(16);
  const verifier = opts.responseType === "code" ? randomString(48) : undefined;
  const codeChallenge = verifier ? await pkceChallenge(verifier) : undefined;
  const url = buildAuthorizeUrl(opts.authorizationUrl, {
    clientId: opts.clientId,
    redirectUri,
    scope: opts.scope,
    state,
    responseType: opts.responseType,
    codeChallenge,
  });
  const popup = window.open(url, "swaggy-oauth", "width=640,height=760");
  if (!popup) throw new Error("Popup blocked — allow popups for this site and retry.");

  return new Promise<string>((resolve, reject) => {
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      window.removeEventListener("message", onMessage);
      clearInterval(poll);
      try { popup.close(); } catch { /* ignore */ }
      fn();
    };
    const onMessage = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || d.source !== "swaggy-oauth") return;
      if (d.state !== state) return finish(() => reject(new Error("State mismatch (possible CSRF).")));
      if (d.error) return finish(() => reject(new Error(d.error_description || d.error)));
      if (opts.responseType === "token") {
        return typeof d.access_token === "string"
          ? finish(() => resolve(d.access_token))
          : finish(() => reject(new Error("No access_token returned.")));
      }
      if (typeof d.code !== "string") return finish(() => reject(new Error("No authorization code returned.")));
      try {
        const token = await requestToken({
          tokenUrl: opts.tokenUrl!,
          grantType: "authorization_code",
          code: d.code,
          redirectUri,
          codeVerifier: verifier,
          clientId: opts.clientId,
          clientSecret: opts.clientSecret,
          clientAuth: "body",
        });
        const at = token.access_token;
        typeof at === "string" ? finish(() => resolve(at)) : finish(() => reject(new Error("No access_token in token response.")));
      } catch (err) {
        finish(() => reject(err as Error));
      }
    };
    // Reject if the user closes the window without completing.
    const poll = setInterval(() => { if (popup.closed) finish(() => reject(new Error("Authorization window closed."))); }, 500);
    window.addEventListener("message", onMessage);
  });
}

/** Build the provider authorize URL for a redirect-based flow (authorization_code / implicit). */
export function buildAuthorizeUrl(
  authorizationUrl: string,
  params: { clientId: string; redirectUri: string; scope?: string; state: string; responseType: "code" | "token"; codeChallenge?: string },
): string {
  const u = new URL(authorizationUrl);
  u.searchParams.set("response_type", params.responseType);
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("state", params.state);
  if (params.scope) u.searchParams.set("scope", params.scope);
  if (params.codeChallenge) {
    u.searchParams.set("code_challenge", params.codeChallenge);
    u.searchParams.set("code_challenge_method", "S256");
  }
  return u.toString();
}

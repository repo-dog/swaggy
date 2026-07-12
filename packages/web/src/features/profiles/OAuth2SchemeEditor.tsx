import { useState } from "react";
import type { SecurityScheme } from "@swaggy/shared";
import type { AuthValue } from "../../store/store.types.js";
import { requestToken, authorizeViaPopup, oauthRedirectUri } from "../request/oauth.js";

const inputCls =
  "w-full rounded-md border border-line bg-surface px-2 py-1 text-sm font-mono text-content outline-none focus:border-line-strong";

const REDIRECT_FLOWS = new Set(["authorizationCode", "implicit"]);

/** OAuth2 credential editor for a scheme, covering all flows:
 *  - client_credentials / password → exchanged via the server token endpoint ("Get token")
 *  - authorization_code (PKCE) / implicit → redirect popup ("Authorize")
 * plus a manual access-token field. */
export function OAuth2SchemeEditor({ scheme, value, onChange }: { scheme: SecurityScheme; value: AuthValue; onChange: (v: AuthValue) => void }) {
  const flows = scheme.flows ?? {};
  const flowNames = Object.keys(flows);
  const [flow, setFlow] = useState<string>(flowNames[0] ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = flow ? flows[flow] : undefined;
  const isRedirect = REDIRECT_FLOWS.has(flow);

  const run = async () => {
    if (!selected) return;
    setBusy(true);
    setStatus(null);
    try {
      let accessToken: string;
      if (isRedirect) {
        if (!selected.authorizationUrl) throw new Error("This flow declares no authorization URL.");
        if (!value.clientId) throw new Error("Client ID is required.");
        accessToken = await authorizeViaPopup({
          responseType: flow === "implicit" ? "token" : "code",
          authorizationUrl: selected.authorizationUrl,
          tokenUrl: selected.tokenUrl,
          clientId: value.clientId,
          clientSecret: value.clientSecret,
          scope: value.scope,
        });
      } else {
        if (!selected.tokenUrl) throw new Error("This flow declares no token URL.");
        const token = await requestToken({
          tokenUrl: selected.tokenUrl,
          grantType: flow === "clientCredentials" ? "client_credentials" : "password",
          clientId: value.clientId,
          clientSecret: value.clientSecret,
          scope: value.scope,
          username: value.username,
          password: value.password,
          clientAuth: "body",
        });
        if (typeof token.access_token !== "string") throw new Error("Response had no access_token.");
        accessToken = token.access_token;
      }
      onChange({ ...value, value: accessToken });
      setStatus("Token acquired ✓");
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <input
        className={inputCls}
        type="password"
        placeholder="access token"
        value={value.value ?? ""}
        onChange={(e) => onChange({ ...value, value: e.target.value })}
      />
      {flowNames.length === 0 ? (
        <span className="text-[11px] text-content-faint">No OAuth2 flows declared — paste a token above.</span>
      ) : (
        <div className="flex flex-col gap-1.5 rounded-md border border-line p-2">
          {flowNames.length > 1 && (
            <select className={inputCls} value={flow} onChange={(e) => { setFlow(e.target.value); setStatus(null); }}>
              {flowNames.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
          <input className={inputCls} placeholder="client id" value={value.clientId ?? ""} onChange={(e) => onChange({ ...value, clientId: e.target.value })} />
          {/* Implicit is a public-client flow — no secret. */}
          {flow !== "implicit" && (
            <input className={inputCls} type="password" placeholder={isRedirect ? "client secret (optional with PKCE)" : "client secret"} value={value.clientSecret ?? ""} onChange={(e) => onChange({ ...value, clientSecret: e.target.value })} />
          )}
          {flow === "password" && (
            <div className="flex gap-1.5">
              <input className={inputCls} placeholder="username" value={value.username ?? ""} onChange={(e) => onChange({ ...value, username: e.target.value })} />
              <input className={inputCls} type="password" placeholder="password" value={value.password ?? ""} onChange={(e) => onChange({ ...value, password: e.target.value })} />
            </div>
          )}
          <input
            className={inputCls}
            placeholder={`scope${selected && Object.keys(selected.scopes ?? {}).length ? ` — e.g. ${Object.keys(selected.scopes ?? {}).slice(0, 3).join(" ")}` : ""}`}
            value={value.scope ?? ""}
            onChange={(e) => onChange({ ...value, scope: e.target.value })}
          />
          {isRedirect && (
            <span className="break-all text-[10px] text-content-faint">Register redirect URI: {oauthRedirectUri()}</span>
          )}
          <button
            onClick={run}
            disabled={busy}
            className="w-fit rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-contrast hover:bg-accent-strong disabled:opacity-50"
          >
            {busy ? (isRedirect ? "Authorizing…" : "Requesting…") : isRedirect ? "Authorize" : "Get token"}
          </button>
          {status && <span className="text-[11px] text-content-muted">{status}</span>}
        </div>
      )}
    </div>
  );
}

import type { Operation, SecurityScheme } from "@swaggy/shared";
import { useSpecs } from "../../hooks/useOperations.js";
import { useStore } from "../../store/store.js";
import type { AuthValue } from "../../store/store.types.js";
import { OAuth2SchemeEditor } from "./OAuth2SchemeEditor.js";

const inputCls =
  "w-full rounded-md border border-line bg-surface px-2 py-1 text-sm font-mono text-content outline-none focus:border-line-strong";

function schemeLabel(s: SecurityScheme): string {
  if (s.type === "apiKey") return `API key · ${s.in}${s.paramName ? ` · ${s.paramName}` : ""}`;
  if (s.type === "http") return `HTTP · ${s.scheme ?? "?"}`;
  if (s.type === "oauth2") return `OAuth2 · ${Object.keys(s.flows ?? {}).join(", ") || "?"}`;
  return "OpenID Connect";
}

function SchemeRow({ scheme, value, onChange, applies }: { scheme: SecurityScheme; value: AuthValue; onChange: (v: AuthValue) => void; applies: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-xs font-semibold text-content">{scheme.key}</span>
        <span className="text-[11px] text-content-muted">{schemeLabel(scheme)}</span>
        {applies && <span className="rounded bg-accent/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent">this op</span>}
      </div>
      {scheme.type === "oauth2" ? (
        <OAuth2SchemeEditor scheme={scheme} value={value} onChange={onChange} />
      ) : scheme.type === "http" && scheme.scheme === "basic" ? (
        <div className="flex gap-1.5">
          <input className={inputCls} placeholder="username" value={value.username ?? ""} onChange={(e) => onChange({ ...value, username: e.target.value })} />
          <input className={inputCls} type="password" placeholder="password" value={value.password ?? ""} onChange={(e) => onChange({ ...value, password: e.target.value })} />
        </div>
      ) : (
        <input
          className={inputCls}
          type="password"
          placeholder={scheme.type === "apiKey" ? "key value" : "token"}
          value={value.value ?? ""}
          onChange={(e) => onChange({ ...value, value: e.target.value })}
        />
      )}
    </div>
  );
}

/** Per-profile authorization editor: enter credentials for each of the spec's security
 * schemes. Values are applied to matching operations at send time (see resolveAuth). Schemes
 * required by the currently-open operation are marked. */
export function AuthEditor({ op }: { op: Operation }) {
  const schemes = useSpecs().data?.find((s) => s.specId === op.specId)?.securitySchemes ?? [];
  const authValues = useStore((s) => s.profiles.find((p) => p.profileId === s.activeProfileId)?.authValues) ?? {};
  const setAuthValue = useStore((s) => s.setAuthValue);

  if (schemes.length === 0) return <p className="text-xs text-content-muted">This spec declares no security schemes.</p>;

  const required = new Set<string>();
  for (const req of op.security ?? []) for (const key of Object.keys(req)) required.add(key);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs text-content-muted">Credentials are stored on the active profile and applied to operations that declare the matching scheme.</span>
      {schemes.map((scheme) => (
        <SchemeRow
          key={scheme.key}
          scheme={scheme}
          value={authValues[scheme.key] ?? {}}
          onChange={(v) => setAuthValue(scheme.key, v)}
          applies={required.has(scheme.key)}
        />
      ))}
    </div>
  );
}

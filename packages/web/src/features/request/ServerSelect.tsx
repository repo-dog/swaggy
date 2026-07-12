import { useState } from "react";
import { Globe } from "lucide-react";
import type { ServerDef } from "@swaggy/shared";

const chip =
  "flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-xs max-w-[16rem] border-line bg-surface text-content-secondary";

/** Substitute {name} placeholders in a server template with the given values (falling back to
 * each variable's declared default). Exported for testing. */
export function substituteServerUrl(url: string, def: ServerDef | undefined, values: Record<string, string>): string {
  if (!def?.variables) return url;
  return url.replace(/\{([^}]+)\}/g, (whole, name) => {
    const v = values[name] ?? def.variables?.[name]?.default;
    return typeof v === "string" ? v : whole;
  });
}

/** Editor for a templated server: one control per variable (enum → dropdown, else text). */
function TemplatedServer({ def, onChange }: { def: ServerDef; onChange: (url: string) => void }) {
  const vars = def.variables ?? {};
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, v.default])),
  );
  const update = (name: string, val: string) => {
    const next = { ...values, [name]: val };
    setValues(next);
    onChange(substituteServerUrl(def.url, def, next));
  };
  return (
    <div className="flex flex-col gap-1">
      <span className={`${chip} w-fit`} title={substituteServerUrl(def.url, def, values)}>
        <Globe className="h-3.5 w-3.5 shrink-0 text-content-faint" />
        <span className="truncate">{substituteServerUrl(def.url, def, values)}</span>
      </span>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(vars).map(([name, v]) => (
          <label key={name} className="flex items-center gap-1 text-[11px] text-content-muted">
            {name}
            {v.enum && v.enum.length > 0 ? (
              <select
                aria-label={name}
                value={values[name]}
                onChange={(e) => update(name, e.target.value)}
                className="rounded border border-line bg-surface px-1 py-0.5 font-mono text-xs text-content-secondary outline-none focus:border-line-strong"
              >
                {v.enum.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : (
              <input
                aria-label={name}
                value={values[name]}
                onChange={(e) => update(name, e.target.value)}
                className="w-24 rounded border border-line bg-surface px-1 py-0.5 font-mono text-xs text-content outline-none focus:border-line-strong"
              />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Compact, spec-scoped base-URL control. A read-only chip for a single fixed server, a
 * dropdown when there's a choice, and a variable editor when a server URL is templated. */
export function ServerSelect({ servers, value, onChange, serverDefs }: { servers: string[]; value: string; onChange: (v: string) => void; serverDefs?: ServerDef[] }) {
  if (servers.length === 0) {
    return (
      <span
        title="This spec declares no server URL — this operation can't be sent."
        className="rounded-md border border-warning/40 bg-warning-subtle px-2 py-1 text-xs font-medium text-warning"
      >
        No server URL
      </span>
    );
  }

  // A single templated server → render variable inputs that rebuild the URL.
  const templated = serverDefs?.find((d) => d.variables && Object.keys(d.variables).length > 0);
  if (serverDefs && serverDefs.length === 1 && templated) {
    return <TemplatedServer def={templated} onChange={onChange} />;
  }

  if (servers.length === 1) {
    return (
      <span className={chip} title={value}>
        <Globe className="h-3.5 w-3.5 shrink-0 text-content-faint" />
        <span className="truncate">{value}</span>
      </span>
    );
  }

  return (
    <span className={chip} title="Base URL (shared across this spec)">
      <Globe className="h-3.5 w-3.5 shrink-0 text-content-faint" />
      <select value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 truncate bg-transparent outline-none" aria-label="Server base URL">
        {servers.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </span>
  );
}

import { Trash2 } from "lucide-react";
import { useStore } from "../../store/store.js";
import { duplicateNameKeys } from "../../lib/duplicates.js";
import { cn } from "../../lib/cn.js";
import type { CommonHeader } from "../../store/store.types.js";

/** Edits the active profile's common headers — any headers sent with every request in
 * this profile (auth tokens, tracing headers, etc.). A same-named header set on an
 * individual request overrides the common one at send time. */
export function CommonHeadersEditor() {
  const active = useStore((s) => s.profiles.find((p) => p.profileId === s.activeProfileId));
  const setCommonHeaders = useStore((s) => s.setCommonHeaders);
  const current = active?.commonHeaders ?? [];
  const rows: CommonHeader[] = current.length ? current : [{ name: "", value: "" }];

  const update = (i: number, patch: Partial<CommonHeader>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    setCommonHeaders(next.filter((r) => r.name || r.value));
  };

  const remove = (i: number) => setCommonHeaders(rows.filter((_, idx) => idx !== i).filter((r) => r.name || r.value));

  // HTTP header names are case-insensitive, so "Authorization" and "authorization" collide.
  const dupes = duplicateNameKeys(rows.map((r) => r.name), { caseInsensitive: true });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-content-muted">Applied to a request only when its spec declares a header of the same name; override it per request in the API details.</span>
      {rows.map((r, i) => {
        const isDup = r.name.trim() !== "" && dupes.has(r.name.trim().toLowerCase());
        const enabled = r.enabled !== false;
        return (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => update(i, { enabled: e.target.checked })}
                aria-label={`${enabled ? "Disable" : "Enable"} header ${r.name || i + 1}`}
                title={enabled ? "Header is active — click to disable" : "Header is disabled — click to enable"}
                className="h-3.5 w-3.5 shrink-0 accent-accent"
              />
              <input
                value={r.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Header"
                aria-invalid={isDup}
                className={cn(
                  "w-28 shrink-0 rounded-md border bg-surface px-2 py-1 text-sm dark:text-content",
                  isDup ? "border-danger" : "border-line",
                  !enabled && "text-content-faint line-through",
                )}
              />
              <input
                value={r.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="Value"
                className={cn(
                  "min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm font-mono dark:text-content",
                  !enabled && "text-content-faint line-through",
                )}
              />
              <button
                aria-label={`Remove header ${r.name || i + 1}`}
                onClick={() => remove(i)}
                className="shrink-0 px-1 text-danger hover:text-danger-strong"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {isDup && <p className="text-[11px] text-danger">Duplicate header name — only one will be sent.</p>}
          </div>
        );
      })}
      <button
        className="w-fit text-xs text-content-muted hover:text-content-secondary"
        onClick={() => setCommonHeaders([...current, { name: "", value: "" }])}
      >
        + Add header
      </button>
    </div>
  );
}

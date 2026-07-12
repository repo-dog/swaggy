import { useEffect, useRef, useState } from "react";
import { Trash2, Copy } from "lucide-react";
import { useStore } from "../../store/store.js";
import { duplicateNameKeys } from "../../lib/duplicates.js";
import { cn } from "../../lib/cn.js";

/** Edit the active profile's variables. Each is referenceable in any request field as
 * {{name}} and can also be captured directly from a response body. */
export function VariablesEditor() {
  const active = useStore((s) => s.profiles.find((p) => p.profileId === s.activeProfileId));
  const setVariables = useStore((s) => s.setVariables);

  // Local editing rows keep a trailing empty row (so "Add" works) while only non-empty
  // names are persisted.
  const [rows, setRows] = useState<[string, string][]>(() => {
    const e = Object.entries(active?.variables ?? {}) as [string, string][];
    return e.length ? e : [["", ""]];
  });

  const sync = (next: [string, string][]) => {
    setRows(next);
    const record: Record<string, string> = {};
    for (const [k, v] of next) if (k.trim()) record[k.trim()] = v;
    setVariables(record);
  };

  // Reflect variables added/updated OUTSIDE this editor (e.g. captured from a response body)
  // so the list refreshes live. Only add-new / update-value — never remove — so rows the user
  // is editing and the trailing empty row are preserved. Our own edits round-trip as no-ops.
  const storedVars = active?.variables;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  useEffect(() => {
    const next = rowsRef.current.map((r) => [r[0], r[1]] as [string, string]);
    let changed = false;
    for (const [k, v] of Object.entries(storedVars ?? {})) {
      const row = next.find((r) => r[0] === k);
      if (!row) { next.push([k, v]); changed = true; }
      else if (row[1] !== v) { row[1] = v; changed = true; }
    }
    if (changed) setRows(next);
  }, [storedVars]);

  // Variable names must be unique (case-sensitive — {{name}} templating is exact); a Record
  // would otherwise silently collapse two same-named rows into one.
  const dupes = duplicateNameKeys(rows.map(([n]) => n));

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-content-secondary">
        Variables (this profile) — reference anywhere as <code className="font-mono">{"{{name}}"}</code>
      </span>
      {rows.map(([name, value], i) => {
        const isDup = name.trim() !== "" && dupes.has(name.trim());
        return (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex gap-2">
              <div className="relative w-40 shrink-0">
                <input
                  value={name}
                  onChange={(e) => sync(rows.map((r, idx) => (idx === i ? [e.target.value, r[1]] : r)))}
                  placeholder="name"
                  aria-invalid={isDup}
                  className={cn(
                    "w-full rounded-md border bg-surface py-1 pl-2 pr-7 text-sm font-mono dark:text-content",
                    isDup ? "border-danger" : "border-line",
                  )}
                />
                {name.trim() && (
                  <button
                    type="button"
                    aria-label={`Copy {{${name.trim()}}}`}
                    title="Copy the {{reference}} to use in a request"
                    onClick={() => navigator.clipboard?.writeText(`{{${name.trim()}}}`)}
                    className="absolute inset-y-0 right-0 flex items-center px-1.5 text-content-faint hover:text-content-secondary"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <input
                value={value}
                onChange={(e) => sync(rows.map((r, idx) => (idx === i ? [r[0], e.target.value] : r)))}
                placeholder="value"
                className="flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm font-mono dark:text-content"
              />
              <button
                aria-label={`Remove variable ${name || i + 1}`}
                onClick={() => sync(rows.filter((_, idx) => idx !== i))}
                className="shrink-0 px-1 text-danger hover:text-danger-strong"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {isDup && <p className="text-[11px] text-danger">Duplicate variable name — only the last value is kept.</p>}
          </div>
        );
      })}
      <button
        className="w-fit text-xs text-content-muted hover:text-content-secondary"
        onClick={() => setRows((r) => [...r, ["", ""]])}
      >
        + Add variable
      </button>
    </div>
  );
}

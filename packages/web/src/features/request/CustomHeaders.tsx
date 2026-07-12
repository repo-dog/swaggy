import { Trash2 } from "lucide-react";
import type { CustomHeader } from "../../store/store.types.js";

/** Editor for ad-hoc request headers beyond the spec's declared header params. Rows are
 * addable/deletable and persist with the request inputs; values support {{variables}}. */
export function CustomHeaders({ headers, onChange }: { headers: CustomHeader[]; onChange: (headers: CustomHeader[]) => void }) {
  const update = (i: number, patch: Partial<CustomHeader>) => onChange(headers.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  const remove = (i: number) => onChange(headers.filter((_, idx) => idx !== i));
  const add = () => onChange([...headers, { name: "", value: "" }]);

  const inputCls = "rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm font-mono text-content outline-none focus:border-line-strong dark:bg-surface dark:text-content";

  return (
    <section className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">Additional headers</span>
      {headers.map((h, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={h.name}
            onChange={(e) => update(i, { name: e.target.value })}
            placeholder="Header-Name"
            aria-label="Header name"
            className={`w-56 shrink-0 ${inputCls}`}
          />
          <input
            value={h.value}
            onChange={(e) => update(i, { value: e.target.value })}
            placeholder="value"
            aria-label={`Value for ${h.name || "header"}`}
            className={`min-w-0 flex-1 ${inputCls}`}
          />
          <button type="button" onClick={() => remove(i)} aria-label="Remove header" className="shrink-0 text-danger hover:text-danger-strong">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="w-fit text-xs text-content-muted hover:text-content-secondary">+ add header</button>
    </section>
  );
}

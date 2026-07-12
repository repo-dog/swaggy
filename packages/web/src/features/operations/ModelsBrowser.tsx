import { useEffect, useMemo, useState } from "react";
import { Boxes, X } from "lucide-react";
import { useSpecs } from "../../hooks/useOperations.js";
import { SchemaOutline } from "../request/SchemaOutline.js";

type NamedSchema = { name: string; schema: unknown };

function ModelRow({ model }: { model: NamedSchema }) {
  return (
    <details className="rounded-md border border-line">
      <summary className="cursor-pointer list-none px-3 py-2 font-mono text-sm text-content hover:bg-surface-muted">{model.name}</summary>
      <div className="border-t border-line p-2">
        <SchemaOutline schema={model.schema} />
      </div>
    </details>
  );
}

/** A modal browser for the active spec's component schemas / definitions. Filterable list;
 * each model expands to its SchemaOutline. */
export function ModelsBrowser({ specId, onClose }: { specId: string | null; onClose: () => void }) {
  const schemas = (useSpecs().data?.find((s) => s.specId === specId)?.schemas ?? []) as NamedSchema[];
  const [filter, setFilter] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const shown = useMemo(
    () => (filter ? schemas.filter((m) => m.name.toLowerCase().includes(filter.toLowerCase())) : schemas),
    [schemas, filter],
  );
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Models" className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Boxes className="h-4 w-4 text-content-muted" />
          <span className="text-sm font-semibold text-content">Models ({schemas.length})</span>
          <button onClick={onClose} aria-label="Close models" className="ml-auto text-content-faint hover:text-content-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-line p-2">
          <input
            autoFocus
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter models…"
            aria-label="Filter models"
            className="w-full rounded-md border border-line bg-surface px-2 py-1 text-sm text-content outline-none placeholder:text-content-faint focus:border-line-strong"
          />
        </div>
        <div className="flex flex-col gap-1.5 overflow-y-auto p-2">
          {shown.length === 0 ? (
            <p className="p-3 text-sm text-content-muted">{schemas.length === 0 ? "This spec declares no component schemas." : "No models match."}</p>
          ) : (
            shown.map((m) => <ModelRow key={m.name} model={m} />)
          )}
        </div>
      </div>
    </div>
  );
}

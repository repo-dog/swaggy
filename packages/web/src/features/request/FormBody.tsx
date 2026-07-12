import { Trash2 } from "lucide-react";
import type { Operation } from "@swaggy/shared";
import { RequiredBadge, schemaHint } from "./fieldMeta.js";
import { formMode, newAdHocPart, type FormPart } from "./formModel.js";

/** Editor for a form request body — multipart/form-data (text + file rows) or
 * x-www-form-urlencoded (text rows only). Schema fields are pre-seeded with fixed names;
 * users can also add ad-hoc rows. Files live in memory only (they can't be persisted). */
export function FormBody({ op, parts, onChange }: { op: Operation; parts: FormPart[]; onChange: (parts: FormPart[]) => void }) {
  const allowFiles = formMode(op.requestBody?.contentType) === "multipart";
  const update = (id: string, patch: Partial<FormPart>) => onChange(parts.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const remove = (id: string) => onChange(parts.filter((p) => p.id !== id));
  const add = () => onChange([...parts, newAdHocPart()]);

  const inputCls = "min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 font-mono text-xs text-content outline-none focus:border-line-strong";

  return (
    <div className="flex flex-col gap-2">
      {parts.map((p) => (
        <div key={p.id} className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={p.enabled}
              onChange={(e) => update(p.id, { enabled: e.target.checked })}
              aria-label={`Include ${p.name || "field"}`}
              className="shrink-0"
            />
            {p.fromSchema ? (
              <span className="w-40 shrink-0 truncate font-mono text-xs text-content" title={p.name}>{p.name}</span>
            ) : (
              <input
                value={p.name}
                onChange={(e) => update(p.id, { name: e.target.value })}
                placeholder="field name"
                aria-label="Field name"
                className="w-40 shrink-0 rounded-md border border-line bg-surface px-2 py-1 font-mono text-xs text-content outline-none focus:border-line-strong"
              />
            )}
            {allowFiles && (
              <select
                value={p.kind}
                onChange={(e) => update(p.id, { kind: e.target.value as FormPart["kind"], value: "", files: [] })}
                aria-label={`Type for ${p.name || "field"}`}
                className="shrink-0 rounded-md border border-line bg-surface px-1 py-1 text-xs text-content"
              >
                <option value="text">text</option>
                <option value="file">file</option>
              </select>
            )}
            {p.kind === "file" ? (
              <input
                type="file"
                multiple
                aria-label={`File for ${p.name || "field"}`}
                onChange={(e) => update(p.id, { files: Array.from(e.target.files ?? []) })}
                className="min-w-0 flex-1 text-xs text-content-secondary file:mr-2 file:rounded file:border file:border-line file:bg-surface-muted file:px-2 file:py-1 file:text-xs file:text-content-secondary"
              />
            ) : (
              <input
                value={p.value}
                onChange={(e) => update(p.id, { value: e.target.value })}
                placeholder="value"
                aria-label={`Value for ${p.name || "field"}`}
                className={inputCls}
              />
            )}
            {p.fromSchema ? (
              <RequiredBadge required={p.required} />
            ) : (
              <button type="button" onClick={() => remove(p.id)} aria-label="Remove field" className="shrink-0 text-danger hover:text-danger-strong">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {p.kind === "file" && p.files.length > 0 && (
            <span className="pl-6 text-[11px] text-content-muted">{p.files.map((f) => f.name).join(", ")}</span>
          )}
          {p.fromSchema && schemaHint(p.schema) && (
            <span className="pl-6 text-[11px] text-content-faint">{schemaHint(p.schema)}</span>
          )}
        </div>
      ))}
      <button type="button" onClick={add} className="w-fit text-xs text-content-muted hover:text-content-secondary">+ add field</button>
    </div>
  );
}

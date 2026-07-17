import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link2, Plus, Check } from "lucide-react";
import type { Operation, Param } from "@swaggy/shared";
import type { RequestInputs } from "./buildProxyRequest.js";
import { validateParam } from "./fieldValidation.js";
import { schemaHint, RequiredBadge } from "./fieldMeta.js";
import { Markdown } from "../common/Markdown.js";
import { useStore } from "../../store/store.js";
import { cn } from "../../lib/cn.js";
import { humanizeLabel } from "../../lib/humanize.js";

function typeLabel(p: Param): string {
  const t = (p.schema as Record<string, unknown> | undefined)?.type as string | undefined;
  return [t, p.in].filter(Boolean).join(", ");
}

/** The example/default the spec suggests for a param, as a fillable string (or undefined). */
function exampleValue(p: Param): string | undefined {
  const schema = (p.schema ?? {}) as Record<string, unknown>;
  const raw = p.example ?? p.default ?? schema.example ?? schema.default;
  if (raw === undefined || raw === null) return undefined;
  return typeof raw === "object" ? JSON.stringify(raw) : String(raw);
}

function isArrayParam(p: Param): boolean {
  return (p.schema as Record<string, unknown> | undefined)?.type === "array";
}

/** Set a scalar field, or drop the key entirely when cleared — so emptying a field
 * reverts it to "not provided" (omitted / null) instead of sending an empty value. */
function setOrDrop<V extends string | string[]>(map: Record<string, V>, name: string, value: string): Record<string, V> {
  const next = { ...map };
  if (value === "") delete next[name];
  else next[name] = value as V;
  return next;
}

function ParamLabel({ p, htmlFor }: { p: Param; htmlFor?: string }) {
  const mode = useStore((s) => s.mode);
  const simpleLabels = useStore((s) => s.simpleLabels);
  const displayName = mode === "simple" && simpleLabels ? humanizeLabel(p.name) : p.name;
  return (
    <label htmlFor={htmlFor} className="pt-1.5 text-xs leading-tight">
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium text-content">{displayName}</span>
        <RequiredBadge required={p.required} />
      </span>
      <span className="mt-0.5 block font-normal text-[11px] text-content-faint">{typeLabel(p)}</span>
      <Markdown className="mt-0.5 text-[11px] font-normal text-content-muted">{p.description}</Markdown>
    </label>
  );
}

/** Hint + clickable "example: …" shown below an input when it has no error. */
function FieldFooter({ p, onFill }: { p: Param; onFill: (v: string) => void }) {
  const hint = schemaHint(p.schema as Record<string, unknown> | undefined);
  const example = exampleValue(p);
  if (!hint && example === undefined) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-content-faint">
      {hint && <span>{hint}</span>}
      {example !== undefined && (
        <button
          type="button"
          onClick={() => onFill(example)}
          title="Fill with the example value from the spec"
          className="text-content-muted underline decoration-dotted underline-offset-2 hover:text-content-secondary"
        >
          example: {example}
        </button>
      )}
    </div>
  );
}

function FieldInput({ p, value, onChange, invalid, placeholder, id, describedBy }: { p: Param; value: string; onChange: (v: string) => void; invalid: boolean; placeholder?: string; id?: string; describedBy?: string }) {
  const schema = (p.schema ?? {}) as Record<string, unknown>;
  const base = cn(
    "w-full rounded-md border bg-surface px-2.5 py-1.5 text-sm font-mono outline-none focus:border-line-strong",
    "dark:bg-surface dark:text-content",
    invalid ? "border-danger" : "border-line",
  );
  const a11y = { id, "aria-invalid": invalid || undefined, "aria-describedby": describedBy };

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return (
      <select {...a11y} value={value} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">— select —</option>
        {schema.enum.map((o) => (
          <option key={String(o)} value={String(o)}>{String(o)}</option>
        ))}
      </select>
    );
  }
  if (schema.type === "boolean") {
    return (
      <select {...a11y} value={value} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">— select —</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  const inputType = schema.type === "integer" || schema.type === "number" ? "number" : "text";
  return <input {...a11y} type={inputType} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cn(base, "placeholder:text-content-faint placeholder:italic")} />;
}

/** Repeatable inputs for an array-typed param, so multi-value query params (?a=1&a=2) are enterable. */
function ArrayField({ values, onChange, invalid }: { values: string[]; onChange: (next: string[]) => void; invalid: boolean }) {
  const list = values.length ? values : [""];
  const base = cn(
    "flex-1 rounded-md border bg-surface px-2.5 py-1.5 text-sm font-mono outline-none focus:border-line-strong",
    "dark:bg-surface dark:text-content",
    invalid ? "border-danger" : "border-line",
  );
  return (
    <div className="flex flex-col gap-1">
      {list.map((v, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            value={v}
            onChange={(e) => onChange(list.map((x, idx) => (idx === i ? e.target.value : x)))}
            className={base}
          />
          <button
            type="button"
            aria-label="Remove value"
            onClick={() => onChange(list.filter((_, idx) => idx !== i))}
            className="shrink-0 px-1 text-danger hover:text-danger-strong"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...list, ""])}
        className="w-fit text-[11px] text-content-muted hover:text-content-secondary"
      >
        + add value
      </button>
    </div>
  );
}

/** A compact icon control shown beside a header input to save its value into the active
 * profile's common headers. If a common header of the same name already exists, it asks
 * whether to replace it or cancel. Purpose is conveyed via the tooltip, not visible text. */
function SaveCommonHeader({ name, value }: { name: string; value: string }) {
  const headers = useStore((s) => s.profiles.find((p) => p.profileId === s.activeProfileId)?.commonHeaders) ?? [];
  const setCommonHeaders = useStore((s) => s.setCommonHeaders);
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(false);
  // Editing the field (or switching op/header) invalidates the previous "saved" / confirm state.
  useEffect(() => { setConfirming(false); setSaved(false); }, [value, name]);
  // The green check is a transient confirmation — revert to the add button after a moment.
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 1500);
    return () => clearTimeout(t);
  }, [saved]);

  const trimmed = value.trim();
  const existingIdx = headers.findIndex((h) => h.name.trim().toLowerCase() === name.trim().toLowerCase());

  const commit = () => {
    const next = existingIdx >= 0
      ? headers.map((h, i) => (i === existingIdx ? { ...h, value } : h))
      : [...headers, { name, value }];
    setCommonHeaders(next);
    setConfirming(false);
    setSaved(true);
  };
  const onClick = () => {
    if (!trimmed) return;
    if (existingIdx >= 0) setConfirming(true);
    else commit();
  };

  if (saved) {
    return <Check aria-label="Added to common headers" className="mt-1.5 h-4 w-4 shrink-0 text-success" />;
  }
  if (confirming) {
    return (
      <span className="mt-1.5 flex shrink-0 items-center gap-1.5 text-[11px]" title={`A common header “${name}” already exists`}>
        <button type="button" onClick={commit} className="font-medium text-warning underline underline-offset-2">Replace</button>
        <button type="button" onClick={() => setConfirming(false)} className="text-content-muted hover:text-content-secondary">Cancel</button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!trimmed}
      aria-label="Add to common headers"
      title={existingIdx >= 0 ? `Replace the existing common header “${name}”` : "Add this header to the active profile’s common headers"}
      className="mt-0.5 shrink-0 rounded p-1 text-content-muted hover:bg-surface-muted hover:text-content-secondary disabled:opacity-40"
    >
      <Plus className="h-4 w-4" />
    </button>
  );
}

function Row({ p, value, onChange, placeholder, inheritedValue, trailing }: { p: Param; value: string; onChange: (v: string) => void; placeholder?: string; inheritedValue?: string; trailing?: ReactNode }) {
  const error = validateParam(p, value);
  // The inherited-common-header hint is only meaningful until the user touches the field.
  // Once they edit it (even to the same value, or clearing it back to empty) it stops
  // showing — an edited field is an explicit override, not an inherited value.
  const [touched, setTouched] = useState(false);
  const handleChange = (v: string) => { setTouched(true); onChange(v); };
  const showInherited = inheritedValue !== undefined && value === "" && !touched;
  const id = `param-${p.in}-${p.name}`;
  const errId = `${id}-err`;
  return (
    <>
      <ParamLabel p={p} htmlFor={id} />
      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <FieldInput p={p} value={value} onChange={handleChange} invalid={Boolean(error)} placeholder={showInherited ? inheritedValue : placeholder} id={id} describedBy={error ? errId : undefined} />
          </div>
          {trailing}
        </div>
        {error ? (
          <p id={errId} className="text-[11px] text-danger">{error}</p>
        ) : showInherited ? (
          <div className="flex items-center gap-1 text-[11px] text-content-faint">
            <Link2 className="h-3 w-3 shrink-0" />
            <span>Inherited from common headers</span>
          </div>
        ) : (
          <FieldFooter p={p} onFill={handleChange} />
        )}
      </div>
    </>
  );
}

function ArrayRow({ p, values, onChange }: { p: Param; values: string[]; onChange: (next: string[]) => void }) {
  const error = validateParam(p, values);
  // A repeatable field has several inputs, so label the group rather than one input.
  return (
    <>
      <ParamLabel p={p} />
      <div role="group" aria-label={p.name} className="flex flex-col gap-1">
        <ArrayField values={values} onChange={onChange} invalid={Boolean(error)} />
        {error && <p className="text-[11px] text-danger">{error}</p>}
      </div>
    </>
  );
}

export function ParamFields({ op, inputs, onChange }: { op: Operation; inputs: RequestInputs; onChange: (p: Partial<RequestInputs>) => void }) {
  // Common (profile) headers keyed by lowercased name, so a header field can show the
  // actual value that will be applied when left blank.
  const profileHeaders = useStore((s) => s.profiles.find((p) => p.profileId === s.activeProfileId)?.commonHeaders);
  const commonHeaders = useMemo(
    () =>
      new Map(
        (profileHeaders ?? [])
          .filter((h) => h.enabled !== false && h.name.trim() && h.value.trim())
          .map((h) => [h.name.toLowerCase(), h.value] as const),
      ),
    [profileHeaders],
  );

  const all = [...op.pathParams, ...op.queryParams, ...op.headerParams];
  if (all.length === 0) return null;
  return (
    <div className="grid grid-cols-[minmax(7rem,10rem)_1fr] items-baseline gap-x-4 gap-y-density-field">
      {op.pathParams.map((p) => (
        <Row key={`p-${p.name}`} p={p} value={inputs.pathParams[p.name] ?? ""} onChange={(v) => onChange({ pathParams: setOrDrop(inputs.pathParams, p.name, v) })} />
      ))}
      {op.queryParams.map((p) => {
        if (isArrayParam(p)) {
          const raw = inputs.query[p.name];
          const arr = Array.isArray(raw) ? raw : raw != null && raw !== "" ? [raw] : [];
          return (
            <ArrayRow
              key={`q-${p.name}`}
              p={p}
              values={arr}
              onChange={(next) => {
                const query = { ...inputs.query };
                if (next.length === 0) delete query[p.name];
                else query[p.name] = next;
                onChange({ query });
              }}
            />
          );
        }
        return (
          <Row key={`q-${p.name}`} p={p} value={(inputs.query[p.name] as string) ?? ""} onChange={(v) => onChange({ query: setOrDrop(inputs.query, p.name, v) })} />
        );
      })}
      {op.headerParams.map((p) => (
        <Row
          key={`h-${p.name}`}
          p={p}
          value={inputs.headers[p.name] ?? ""}
          inheritedValue={commonHeaders.get(p.name.toLowerCase())}
          onChange={(v) => onChange({ headers: setOrDrop(inputs.headers, p.name, v) })}
          trailing={<SaveCommonHeader name={p.name} value={inputs.headers[p.name] ?? ""} />}
        />
      ))}
    </div>
  );
}

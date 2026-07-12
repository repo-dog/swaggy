import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { RequiredBadge, schemaHint, schemaTypeLabel, enumValues, defaultValueHint } from "./fieldMeta.js";
import { Markdown } from "../common/Markdown.js";

type Schema = Record<string, any>;

const MAX_ENUM = 5;

/** The object schema whose properties should be nested under this field: the field itself
 * if it's an object, or its item schema if it's an array of objects. Null for leaves. */
function nestedObjectSchema(schema: Schema): Schema | null {
  if (schema.type === "object" || (!schema.type && schema.properties)) return schema;
  if (schema.type === "array" && schema.items && typeof schema.items === "object") {
    const items = schema.items as Schema;
    if (items.type === "object" || items.properties) return items;
  }
  return null;
}

function objectEntries(schema: Schema): [string, Schema][] {
  return Object.entries<Schema>(schema.properties ?? {});
}

function EnumHint({ values }: { values: string[] }) {
  const shown = values.slice(0, MAX_ENUM);
  const extra = values.length - shown.length;
  return (
    <span className="text-content-muted">
      enum: {shown.join(" │ ")}
      {extra > 0 ? ` │ … +${extra} more` : ""}
    </span>
  );
}

/** One field row: name, type, required/optional, constraints, allowed values, default —
 * with the description on a muted line beneath, and object/array children nested below. */
function Field({ name, schema, required, depth }: { name: string; schema: Schema; required: boolean; depth: number }) {
  const nested = nestedObjectSchema(schema);
  const children = nested ? objectEntries(nested) : [];
  const collapsible = children.length > 0;
  const [open, setOpen] = useState(true);
  const requiredChildren: string[] = (nested?.required as string[]) ?? [];
  const hint = schemaHint(schema);
  const enums = enumValues(schema);
  const def = defaultValueHint(schema);
  const description = typeof schema.description === "string" ? schema.description : null;
  const indent = depth * 14;

  return (
    <div>
      <div
        style={{ paddingLeft: indent }}
        className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded px-1 py-0.5 hover:bg-black/5 dark:hover:bg-white/5"
      >
        {collapsible ? (
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? `Collapse ${name}` : `Expand ${name}`}
            className="shrink-0 text-content-faint hover:text-content-secondary dark:hover:text-content-secondary"
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="inline-block w-3 shrink-0" />
        )}
        <span className="font-medium text-accent">{name}</span>
        <span className="text-content-muted">{schemaTypeLabel(schema)}</span>
        <RequiredBadge required={required} />
        {hint && <span className="text-content-muted">{hint}</span>}
        {enums && <EnumHint values={enums} />}
        {def !== null && <span className="text-content-muted">= {def}</span>}
      </div>
      {description && (
        <div style={{ paddingLeft: indent + 18 }} className="pr-1">
          <Markdown className="text-[11px] text-content-muted">{description}</Markdown>
        </div>
      )}
      {collapsible &&
        open &&
        children.map(([k, v]) => (
          <Field key={k} name={k} schema={v} required={requiredChildren.includes(k)} depth={depth + 1} />
        ))}
    </div>
  );
}

/** A compact, read-only reference tree for a request body's JSON schema. Renders the top-level
 * object's properties (each field's type, status, constraints, allowed values, default,
 * description); non-object roots render as a single expandable field. */
export function SchemaOutline({ schema: raw }: { schema: unknown }) {
  if (!raw || typeof raw !== "object") return <p className="p-2 text-xs text-content-muted">No schema.</p>;
  const schema = raw as Schema;
  const rootRequired: string[] = (schema.required as string[]) ?? [];
  const entries = schema.type === "object" || (!schema.type && schema.properties) ? objectEntries(schema) : [];
  return (
    <div className="font-mono text-xs leading-relaxed text-content-secondary">
      {entries.length > 0 ? (
        entries.map(([k, v]) => <Field key={k} name={k} schema={v} required={rootRequired.includes(k)} depth={0} />)
      ) : (
        <Field name="body" schema={schema} required depth={0} />
      )}
    </div>
  );
}

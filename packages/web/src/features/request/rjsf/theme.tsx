import { createContext, useContext, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import type {
  WidgetProps,
  FieldTemplateProps,
  BaseInputTemplateProps,
  ObjectFieldTemplateProps,
  ArrayFieldTemplateProps,
} from "@rjsf/utils";
import { cn } from "../../../lib/cn.js";
import { schemaHint, RequiredBadge } from "../fieldMeta.js";
import { Markdown } from "../../common/Markdown.js";
import { useStore } from "../../../store/store.js";
import { humanizeLabel } from "../../../lib/humanize.js";

// Gates whether field validation errors are *displayed*. Validation itself stays live (so
// errors are always current, never stale), but we hide them until the user has edited the
// form — otherwise an untouched form flags empty optional/required fields on first load.
export const ShowErrorsContext = createContext(true);

const inputCls = (invalid?: boolean) =>
  cn(
    "w-full rounded-md border bg-surface px-2.5 py-1.5 text-sm font-mono outline-none focus:border-line-strong",
    "dark:bg-surface dark:text-content",
    invalid ? "border-danger" : "border-line",
  );

export function BaseInputTemplate(props: BaseInputTemplateProps) {
  const { id, value, onChange, onBlur, onFocus, type, placeholder, required, disabled, readonly, rawErrors } = props;
  const invalid = Array.isArray(rawErrors) && rawErrors.length > 0;
  return (
    <input
      id={id}
      type={type || "text"}
      className={inputCls(invalid)}
      value={value ?? ""}
      required={required}
      disabled={disabled || readonly}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      onBlur={onBlur ? (e) => onBlur(id, e.target.value) : undefined}
      onFocus={onFocus ? (e) => onFocus(id, e.target.value) : undefined}
    />
  );
}

export function FieldTemplate(props: FieldTemplateProps) {
  const { id, label, children, rawErrors = [], rawDescription, required, hidden, displayLabel, schema } = props;
  const showErrors = useContext(ShowErrorsContext);
  const mode = useStore((s) => s.mode);
  const simpleLabels = useStore((s) => s.simpleLabels);
  const displayedLabel = mode === "simple" && simpleLabels ? humanizeLabel(label) : label;
  if (hidden) return <div className="hidden">{children}</div>;
  // Enum choices / format / range hint, so allowed values are visible without opening the control.
  const hint = schemaHint(schema as Record<string, unknown>);
  return (
    <div className="flex flex-col gap-1 py-1.5">
      {displayLabel && displayedLabel ? (
        <span className="flex flex-wrap items-center gap-1.5">
          <label htmlFor={id} className="text-xs font-medium text-content">
            {displayedLabel}
          </label>
          <RequiredBadge required={required} />
        </span>
      ) : null}
      {children}
      {/* Reference info (description + allowed values) stays visible even when there's a
          validation error, so you can always see what a field expects. Error shown below. */}
      {rawDescription ? <Markdown className="text-[11px] text-content-faint">{rawDescription}</Markdown> : null}
      {hint ? <p className="text-[11px] text-content-faint">{hint}</p> : null}
      {showErrors && rawErrors.length > 0 ? <p className="text-[11px] text-danger">{rawErrors[0]}</p> : null}
    </div>
  );
}

export function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  const { title, description, properties } = props;
  const [open, setOpen] = useState(true); // nested objects default to expanded
  const fields = (
    <>
      {description ? <Markdown className="text-[11px] text-content-faint">{description}</Markdown> : null}
      {properties.map((el) => (
        <div key={el.name}>{el.content}</div>
      ))}
    </>
  );
  // The root body object has no title — render it as a plain container. A titled (nested)
  // object gets a collapsible header so large bodies stay navigable; expanded by default.
  if (!title) {
    return <div className="flex flex-col gap-1 rounded-md border border-line p-3">{fields}</div>;
  }
  return (
    <div className="rounded-md border border-line">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-content-muted hover:bg-surface-muted"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {title}
      </button>
      {open && <div className="flex flex-col gap-1 border-t border-line p-3">{fields}</div>}
    </div>
  );
}

// rjsf's default array template is Bootstrap-styled (glyphicon add/remove buttons,
// col-xs layout) which renders invisibly without Bootstrap CSS — so array fields looked
// empty. This renders array items with visible Tailwind add/remove controls.
export function ArrayFieldTemplate(props: ArrayFieldTemplateProps) {
  const { title, items, canAdd, onAddClick, required, schema } = props;
  const itemHint = schemaHint((schema as { items?: Record<string, unknown> } | undefined)?.items);
  const mode = useStore((s) => s.mode);
  const simpleLabels = useStore((s) => s.simpleLabels);
  const displayedTitle = title && mode === "simple" && simpleLabels ? humanizeLabel(title) : title;
  return (
    <div className="flex flex-col gap-1.5">
      {displayedTitle ? (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-content">{displayedTitle}</span>
          <RequiredBadge required={required} />
        </span>
      ) : null}
      {itemHint ? <p className="text-[11px] text-content-faint">{itemHint}</p> : null}
      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.key} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">{item.children}</div>
              {item.hasRemove ? (
                <button
                  type="button"
                  aria-label="Remove item"
                  onClick={item.onDropIndexClick(item.index)}
                  className="mt-1.5 shrink-0 px-1 text-danger hover:text-danger-strong"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {canAdd ? (
        <button
          type="button"
          onClick={onAddClick}
          className="flex w-fit items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-medium text-content-secondary hover:bg-surface-muted hover:text-content dark:hover:text-content"
        >
          <Plus className="h-3.5 w-3.5" /> Add item
        </button>
      ) : null}
    </div>
  );
}

export function SelectWidget(props: WidgetProps) {
  const { id, value, onChange, options, required, rawErrors } = props;
  const enumOptions = (options?.enumOptions ?? []) as { value: unknown; label: string }[];
  const invalid = Array.isArray(rawErrors) && rawErrors.length > 0;
  return (
    <select
      id={id}
      className={inputCls(invalid)}
      value={value ?? ""}
      required={required}
      onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
    >
      <option value="">— select —</option>
      {enumOptions.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function CheckboxWidget(props: WidgetProps) {
  const { id, value, onChange, label } = props;
  const mode = useStore((s) => s.mode);
  const simpleLabels = useStore((s) => s.simpleLabels);
  const displayedLabel = mode === "simple" && simpleLabels ? humanizeLabel(label) : label;
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 text-sm text-content-secondary">
      <input id={id} type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
      {displayedLabel}
    </label>
  );
}

export const swaggyTemplates = { BaseInputTemplate, FieldTemplate, ObjectFieldTemplate, ArrayFieldTemplate };
export const swaggyWidgets = { SelectWidget, CheckboxWidget };

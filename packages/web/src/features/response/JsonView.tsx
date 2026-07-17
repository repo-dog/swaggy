import { useState } from "react";
import { Copy, Check, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { splitHighlight } from "../palette/highlight.js";

/** Copy a value to the clipboard: strings as-is, everything else as pretty JSON. */
function copyValue(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  navigator.clipboard?.writeText(text);
}

function renderPrimitive(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "string") return `"${v}"`;
  return String(v);
}

function primitiveClass(v: unknown): string {
  if (typeof v === "string") return "text-emerald-300";
  if (typeof v === "number") return "text-amber-300";
  if (typeof v === "boolean") return "text-violet-300";
  return "text-slate-400"; // null / undefined
}

function primitiveText(v: unknown): string {
  return v === null ? "null" : typeof v === "string" ? v : String(v);
}

/** Should this subtree be shown for the current filter? True if the key or any
 * descendant key/value matches (so ancestors of a match stay visible). */
function subtreeMatches(label: string | undefined, value: unknown, q: string): boolean {
  if (!q) return true;
  const ql = q.toLowerCase();
  if (label !== undefined && label.toLowerCase().includes(ql)) return true;
  if (value === null || typeof value !== "object") return primitiveText(value).toLowerCase().includes(ql);
  const entries = Array.isArray(value)
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);
  return entries.some(([k, v]) => subtreeMatches(k, v, q));
}

function CopyButton({ value, label }: { value: unknown; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        copyValue(value);
        setDone(true);
        setTimeout(() => setDone(false), 1000);
      }}
      className="flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-white/10 hover:text-sky-300"
    >
      {done ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

type CaptureFn = (value: unknown, suggestedName?: string) => void;

function CaptureButton({ value, suggestedName, onCapture }: { value: unknown; suggestedName?: string; onCapture: CaptureFn }) {
  return (
    <button
      aria-label={`Save ${suggestedName ?? "value"} as variable`}
      title="Save as variable"
      onClick={(e) => {
        e.stopPropagation();
        onCapture(value, suggestedName);
      }}
      className="flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-emerald-500 hover:text-white"
    >
      <Plus className="h-3 w-3" />
    </button>
  );
}

/** Per-row actions shown inline after the value. Set off from the value and spaced apart from
 * each other so the two targets don't sit cramped together — copy is frequent and harmless,
 * but "save as variable" has a side effect, so a stray click between them is what we avoid. */
function RowActions({ value, copyLabel, suggestedName, onCapture }: { value: unknown; copyLabel: string; suggestedName?: string; onCapture?: CaptureFn }) {
  return (
    <span className="ml-3 flex shrink-0 items-center gap-2">
      <CopyButton value={value} label={copyLabel} />
      {onCapture && <CaptureButton value={value} suggestedName={suggestedName} onCapture={onCapture} />}
    </span>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  return (
    <>
      {splitHighlight(text, query).map((part, i) =>
        part.match
          ? <mark key={i} className="bg-amber-200 text-slate-900 dark:bg-amber-500">{part.text}</mark>
          : <span key={i}>{part.text}</span>
      )}
    </>
  );
}

function Node({ label, value, depth, filter, onCapture }: { label?: string; value: unknown; depth: number; filter: string; onCapture?: CaptureFn }) {
  const [open, setOpen] = useState(true);
  const pad = { paddingLeft: `${depth * 14}px` };
  const copyLabel = `Copy ${label ?? "value"}`;

  if (!subtreeMatches(label, value, filter)) return null;

  // Leaf: primitive or null.
  if (value === null || typeof value !== "object") {
    return (
      <div style={pad} className="flex items-center rounded px-1 hover:bg-white/5">
        {/* Spacer keeps primitive keys aligned with object/array keys (which have a chevron button). */}
        <span className="mr-0.5 inline-block w-3 shrink-0" aria-hidden />
        {label !== undefined && <span className="mr-1 text-sky-300"><Highlight text={label} query={filter} />:</span>}
        <span className={primitiveClass(value)}><Highlight text={renderPrimitive(value)} query={filter} /></span>
        <RowActions value={value} copyLabel={copyLabel} suggestedName={label} onCapture={onCapture} />
      </div>
    );
  }

  const isArray = Array.isArray(value);
  // When this node's own label matches the filter, show all children unfiltered.
  const labelMatches = !!filter && label !== undefined && label.toLowerCase().includes(filter.toLowerCase());
  const allEntries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);
  const entries = allEntries.filter(([k, v]) => !filter || labelMatches || subtreeMatches(k, v, filter));
  const open_ = isArray ? "[" : "{";
  const close_ = isArray ? "]" : "}";
  // Force nodes open while filtering so matches deep in the tree are visible.
  const expanded = filter ? true : open;

  return (
    <div>
      <div style={pad} className="flex items-center rounded px-1 hover:bg-white/5">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="mr-0.5 shrink-0 text-slate-400 hover:text-slate-200"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        {label !== undefined && <span className="mr-1 text-sky-300"><Highlight text={label} query={filter} />:</span>}
        <span className="text-slate-500">{expanded ? open_ : `${open_}…${close_}`}</span>
        <span className="ml-1 text-slate-600">{entries.length} {entries.length === 1 ? "item" : "items"}</span>
        <RowActions value={value} copyLabel={copyLabel} suggestedName={label} onCapture={onCapture} />
      </div>
      {expanded && (
        <>
          {entries.map(([k, v]) => (
            // When this node's label matched, pass empty filter to children so their
            // subtreeMatches guard doesn't hide them (they're shown unconditionally).
            <Node key={k} label={k} value={v} depth={depth + 1} filter={labelMatches ? "" : filter} onCapture={onCapture} />
          ))}
          <div style={pad} className="px-1 text-slate-500">{close_}</div>
        </>
      )}
    </div>
  );
}

/** Interactive JSON tree: filterable, collapsible nodes with per-value copy buttons.
 * When `onCapture` is provided, each node also gets a "save as variable" button. */
export function JsonView({ data, onCapture }: { data: unknown; onCapture?: CaptureFn }) {
  const [filter, setFilter] = useState("");
  const empty = filter !== "" && !subtreeMatches(undefined, data, filter);
  return (
    <div className="rounded-md bg-slate-900 font-mono text-xs leading-relaxed text-slate-100 dark:bg-slate-950 dark:ring-1 dark:ring-slate-800">
      {/* Sticky so the filter stays reachable while scrolling a long body. It sticks to the
          top of whichever element is scrolling — the inline viewer's max-h box and the
          expanded popup are both scroll ancestors, so this covers both views. */}
      <div className="sticky top-0 z-10 rounded-t-md bg-slate-900 p-2 dark:bg-slate-950">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter keys & values…"
          aria-label="Filter response"
          className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-slate-500"
        />
      </div>
      <div className="px-2 pb-2">
        {empty ? (
          <p className="px-1 text-slate-500">No matches.</p>
        ) : (
          <Node value={data} depth={0} filter={filter} onCapture={onCapture} />
        )}
      </div>
    </div>
  );
}

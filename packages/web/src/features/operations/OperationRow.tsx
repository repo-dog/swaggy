import type { Operation } from "@swaggy/shared";
import { GripVertical } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { BookmarkButton } from "../profiles/BookmarkButton.js";
import { useStore } from "../../store/store.js";
import { splitHighlight } from "../palette/highlight.js";

const METHOD_COLOR: Record<string, string> = {
  GET: "text-method-get",
  POST: "text-method-post",
  PUT: "text-method-put",
  PATCH: "text-method-patch",
  DELETE: "text-method-delete",
};

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  return (
    <>
      {splitHighlight(text, query).map((part, i) =>
        part.match
          ? <mark key={i} className="bg-amber-200 text-content dark:bg-amber-600 dark:text-white">{part.text}</mark>
          : <span key={i}>{part.text}</span>
      )}
    </>
  );
}

export function OperationRow({
  op,
  selected,
  onSelect,
  query,
  draggable = false,
  dragging = false,
  onDragStart,
  onDrop,
  onDragEnd,
}: {
  op: Operation;
  selected: boolean;
  onSelect: (id: string) => void;
  query?: string;
  // Drag-to-reorder support (used only in the Bookmarks section).
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: () => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
}) {
  const mode = useStore((s) => s.mode);
  const isSimple = mode === "simple";
  const primaryLabel = isSimple ? (op.summary || op.description || op.path) : op.path;
  const subtext = isSimple
    ? (op.summary || op.description ? op.path : null)
    : (op.summary ?? null);
  const primaryMono = !isSimple;

  return (
    // data-op-id lets the sidebar scroll a freshly-selected row into view.
    <div
      data-op-id={op.id}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragOver={draggable ? (e) => e.preventDefault() : undefined}
      onDrop={draggable ? (e) => { e.preventDefault(); onDrop?.(); } : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      className={cn(
        "group flex items-center border-l-2 border-l-transparent border-t border-t-line hover:bg-surface-muted",
        selected && "border-l-accent bg-accent-subtle hover:bg-accent-subtle",
        dragging && "opacity-40",
      )}
    >
      {draggable && (
        <span
          aria-hidden
          className="cursor-grab pl-1 text-content-faint group-hover:text-content-muted"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </span>
      )}
      <button
        onClick={() => onSelect(op.id)}
        className="flex min-w-0 flex-1 flex-col px-2.5 py-density-row text-left"
      >
        <span className="flex items-center gap-2">
          <span className={cn("w-12 shrink-0 text-[10px] font-semibold", METHOD_COLOR[op.method] ?? "text-content-muted")}>
            {op.method}
          </span>
          <span
            title={op.deprecated ? "Deprecated" : undefined}
            className={cn("min-w-0",
              "truncate text-density-primary leading-5 text-content",
              primaryMono && "font-mono",
              op.deprecated && "text-content-faint line-through",
            )}
          >
            <Highlighted text={primaryLabel} query={query ?? ""} />
          </span>
        </span>
        {subtext && (
          <span className="truncate pl-14 font-mono text-density-secondary leading-4 text-content-muted">
            <Highlighted text={subtext} query={query ?? ""} />
          </span>
        )}
      </button>
      <BookmarkButton operationId={op.id} className="mr-2 shrink-0 p-1" />
    </div>
  );
}

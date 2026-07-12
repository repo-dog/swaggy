import type { Operation } from "@swaggy/shared";
import { GripVertical } from "lucide-react";
import { cn } from "../../lib/cn.js";
import { BookmarkButton } from "../profiles/BookmarkButton.js";

const METHOD_COLOR: Record<string, string> = {
  GET: "text-method-get",
  POST: "text-method-post",
  PUT: "text-method-put",
  PATCH: "text-method-patch",
  DELETE: "text-method-delete",
};

export function OperationRow({
  op,
  selected,
  onSelect,
  draggable = false,
  dragging = false,
  onDragStart,
  onDrop,
  onDragEnd,
}: {
  op: Operation;
  selected: boolean;
  onSelect: (id: string) => void;
  // Drag-to-reorder support (used only in the Bookmarks section).
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: () => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
}) {
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
        // Side-specific border colors: a top rule on every row (uniform separators, incl. the
        // first) and a transparent left accent that turns blue when selected. Using shorthand
        // border-transparent would override the top color, so keep them split.
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
        className="flex min-w-0 flex-1 flex-col px-2.5 py-1 text-left"
      >
        <span className="flex items-center gap-2">
          <span className={cn("w-12 text-[10px] font-semibold", METHOD_COLOR[op.method] ?? "text-content-muted")}>
            {op.method}
          </span>
          <span
            title={op.deprecated ? "Deprecated" : undefined}
            className={cn("truncate font-mono text-[13px] leading-5 text-content", op.deprecated && "text-content-faint line-through")}
          >
            {op.path}
          </span>
        </span>
        {op.summary && <span className="truncate pl-14 text-[11px] leading-4 text-content-muted">{op.summary}</span>}
      </button>
      <BookmarkButton operationId={op.id} className="mr-2 shrink-0 p-1" />
    </div>
  );
}

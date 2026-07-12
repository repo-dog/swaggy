import { useCallback, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn.js";

/** Fraction of the viewport a sidebar may occupy at most. */
const MAX_VIEWPORT_FRACTION = 0.3;
const MIN_WIDTH = 200;

/** Clamp a proposed sidebar width to [MIN_WIDTH, 30% of viewport]. */
export function clampSidebarWidth(width: number, viewportWidth: number): number {
  const max = Math.max(MIN_WIDTH, viewportWidth * MAX_VIEWPORT_FRACTION);
  return Math.max(MIN_WIDTH, Math.min(width, max));
}

/** A sidebar that can be drag-resized (capped at 30% of the viewport) and collapsed to a thin
 * strip. `side` controls which edge carries the resize handle and how the drag maps to width. */
export function ResizableSidebar({
  side,
  label,
  width,
  onWidth,
  defaultWidth,
  collapsed,
  onCollapsedChange,
  children,
}: {
  side: "left" | "right";
  label: string;
  width: number;
  onWidth: (width: number) => void;
  /** Width restored when the resize handle is double-clicked. */
  defaultWidth: number;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  children: ReactNode;
}) {
  const edgeBorder = side === "left" ? "border-r" : "border-l";

  const onHandleDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width;
      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        // Left panel grows when dragging right; right panel grows when dragging left.
        const raw = side === "left" ? startWidth + delta : startWidth - delta;
        onWidth(clampSidebarWidth(raw, window.innerWidth));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [side, width, onWidth],
  );

  if (collapsed) {
    const ExpandIcon = side === "left" ? ChevronRight : ChevronLeft;
    return (
      <button
        onClick={() => onCollapsedChange(false)}
        aria-label={`Show ${label}`}
        title={`Show ${label}`}
        className={cn(
          "flex w-8 shrink-0 flex-col items-center gap-2 py-2 text-content-faint hover:bg-surface-muted hover:text-content-secondary",
          edgeBorder,
          "border-line",
        )}
      >
        <ExpandIcon className="h-4 w-4" />
        <span className="text-[10px] font-semibold uppercase tracking-wide [writing-mode:vertical-rl]">{label}</span>
      </button>
    );
  }

  // Cap the rendered width to the current viewport in case it shrank since the width was saved.
  const rendered = typeof window !== "undefined" ? clampSidebarWidth(width, window.innerWidth) : width;
  const CollapseIcon = side === "left" ? ChevronLeft : ChevronRight;

  return (
    <div style={{ width: rendered }} className={cn("relative flex min-h-0 shrink-0 flex-col", edgeBorder, "border-line")}>
      {children}
      {/* Resize handle sitting on the panel's inner edge; drag to resize. A chevron button
          centered on it collapses the panel (its own click, so it doesn't start a drag). */}
      <div
        onMouseDown={onHandleDown}
        onDoubleClick={() => onWidth(defaultWidth)}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${label}`}
        title={`Drag to resize ${label} · double-click to reset`}
        className={cn(
          "group absolute inset-y-0 z-20 flex w-2 cursor-col-resize items-center justify-center hover:bg-accent/20",
          side === "left" ? "right-0" : "left-0",
        )}
      >
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onCollapsedChange(true)}
          aria-label={`Hide ${label}`}
          title={`Hide ${label}`}
          className="pointer-events-auto rounded-full border border-line bg-surface p-0.5 text-content-faint opacity-0 shadow-sm hover:text-content-secondary group-hover:opacity-100"
        >
          <CollapseIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

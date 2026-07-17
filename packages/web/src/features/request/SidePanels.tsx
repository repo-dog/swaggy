import { useState, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import type { Operation } from "@swaggy/shared";
import { useStore, DEFAULT_RIGHT_SIDEBAR_WIDTH } from "../../store/store.js";
import { cn } from "../../lib/cn.js";
import type { HistoryEntry, Snapshot } from "../../store/store.types.js";
import { applyOrder, reorderById } from "../operations/dnd.js";
import { SnapshotsPanel } from "./SnapshotsPanel.js";
import { ResizableSidebar } from "../layout/ResizableSidebar.js";
import { CommonHeadersEditor } from "../profiles/CommonHeadersEditor.js";
import { AuthEditor } from "../profiles/AuthEditor.js";
import { VariablesEditor } from "../profiles/VariablesEditor.js";
import { HistoryPanel } from "../history/HistoryPanel.js";

const DEFAULT_HEIGHT = 160;
// ~one row plus the body's vertical padding, so a panel can shrink to a single item.
const MIN_HEIGHT = 56;
const MAX_HEIGHT = 640;
const clampHeight = (h: number) => Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, h));

type Card = { key: string; title: string; defaultOpen: boolean; body: ReactNode };

const SelectApiHint = ({ children }: { children: ReactNode }) => <p className="text-xs text-content-faint">{children}</p>;

/** Drag handle at the bottom of a card that adjusts (and persists) its body height. */
function ResizeHandle({ label, height, onChange }: { label: string; height: number; onChange: (h: number) => void }) {
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    const move = (ev: PointerEvent) => onChange(clampHeight(startH + (ev.clientY - startY)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={`Resize ${label} panel`}
      onPointerDown={onPointerDown}
      className="flex h-1.5 cursor-row-resize items-center justify-center border-t border-line hover:bg-surface-muted"
    >
      <div className="h-0.5 w-6 rounded-full bg-line-strong" />
    </div>
  );
}

/** One right-panel card: a drag-to-reorder handle + collapse toggle in the header, and a
 * resizable, scrollable body. */
function PanelCard({
  card, open, onToggle, height, onResize, dragging, onDragStart, onDrop, onDragEnd,
}: {
  card: Card; open: boolean; onToggle: () => void; height: number; onResize: (h: number) => void;
  dragging: boolean; onDragStart: () => void; onDrop: () => void; onDragEnd: () => void;
}) {
  return (
    <section
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      className={cn("rounded-lg border border-line", dragging && "opacity-50")}
    >
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className="group flex items-center gap-1 px-1.5 py-density-row"
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-content-faint group-hover:text-content-muted" aria-label="Drag to reorder" />
        <button
          onClick={onToggle}
          aria-expanded={open}
          className="flex flex-1 items-center gap-1.5 text-left text-density-sm font-semibold uppercase tracking-wide text-content-secondary"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {card.title}
        </button>
      </div>
      {open && (
        <div className="border-t border-line">
          <div style={{ height }} className="overflow-auto px-2 py-2">{card.body}</div>
          <ResizeHandle label={card.title} height={height} onChange={onResize} />
        </div>
      )}
    </section>
  );
}

/** The right rail of panels. Stays mounted whether or not an operation is selected; the
 * profile-level cards always work, while op-scoped cards (snapshots, authorization) prompt
 * the user to pick an API. Cards are drag-reorderable and individually resizable. */
export function SidePanels({
  op, onApplySnapshot, onReplay,
}: {
  op: Operation | null;
  onApplySnapshot?: (snap: Snapshot) => void;
  onReplay: (entry: HistoryEntry) => void;
}) {
  const activeProfileId = useStore((s) => s.activeProfileId);
  const rightWidth = useStore((s) => s.rightSidebarWidth);
  const setRightWidth = useStore((s) => s.setRightSidebarWidth);
  const rightCollapsed = useStore((s) => s.rightSidebarCollapsed);
  const setRightCollapsed = useStore((s) => s.setRightSidebarCollapsed);
  const order = useStore((s) => s.sidePanelOrder);
  const setOrder = useStore((s) => s.setSidePanelOrder);
  const sections = useStore((s) => s.sidePanelSections);
  const setSection = useStore((s) => s.setSidePanelSection);
  const heights = useStore((s) => s.sidePanelHeights);
  const setHeight = useStore((s) => s.setSidePanelHeight);
  const [dragId, setDragId] = useState<string | null>(null);

  const cards: Card[] = [
    { key: "snapshots", title: "Snapshots", defaultOpen: true, body: <SnapshotsPanel op={op} onApply={onApplySnapshot ?? (() => {})} /> },
    { key: "authorization", title: "Authorization", defaultOpen: false, body: op ? <AuthEditor op={op} /> : <SelectApiHint>Select an API to manage its authorization.</SelectApiHint> },
    { key: "commonHeaders", title: "Common headers", defaultOpen: false, body: <CommonHeadersEditor /> },
    { key: "variables", title: "Variables", defaultOpen: false, body: <VariablesEditor key={activeProfileId} /> },
    { key: "history", title: "History", defaultOpen: false, body: <HistoryPanel onReplay={onReplay} /> },
  ];
  const ordered = applyOrder(cards, (c) => c.key, order);
  const orderedKeys = ordered.map((c) => c.key);
  const onDrop = (dropKey: string) => {
    if (dragId) setOrder(reorderById(orderedKeys, dragId, dropKey));
    setDragId(null);
  };

  return (
    <ResizableSidebar
      side="right"
      label="Headers - Variables - Snapshots - History"
      width={rightWidth}
      onWidth={setRightWidth}
      defaultWidth={DEFAULT_RIGHT_SIDEBAR_WIDTH}
      collapsed={rightCollapsed}
      onCollapsedChange={setRightCollapsed}
    >
      {/* pl-2 exactly clears the sidebar's 8px resize handle; pr-1 keeps the cards near the
          window edge. Anything more just steals width from the content. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto py-1 pl-2 pr-1">
        {ordered.map((card) => {
          const open = sections[card.key] ?? card.defaultOpen;
          return (
            <PanelCard
              key={card.key}
              card={card}
              open={open}
              onToggle={() => setSection(card.key, !open)}
              height={heights[card.key] ?? DEFAULT_HEIGHT}
              onResize={(h) => setHeight(card.key, h)}
              dragging={dragId === card.key}
              onDragStart={() => setDragId(card.key)}
              onDrop={() => onDrop(card.key)}
              onDragEnd={() => setDragId(null)}
            />
          );
        })}
      </div>
    </ResizableSidebar>
  );
}

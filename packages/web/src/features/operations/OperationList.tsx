import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Star, GripVertical, Boxes, Pin, PinOff } from "lucide-react";
import { useOperations, useSpecs } from "../../hooks/useOperations.js";
import { useStore } from "../../store/store.js";
import { cn } from "../../lib/cn.js";
import { reconcileBookmarks } from "./reconcile.js";
import { reorderById, applyOrder } from "./dnd.js";
import { groupOperations } from "./grouping.js";
import { sectionColors, type SectionPalette } from "./sectionColor.js";
import { OperationRow } from "./OperationRow.js";
import { SpecInfo } from "./SpecInfo.js";
import { ModelsBrowser } from "./ModelsBrowser.js";

// Bookmarks always uses amber (with the star) so it stays recognisable regardless of hashing.
const BOOKMARK_PALETTE: SectionPalette = {
  header: "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60",
  border: "border-amber-300 dark:border-amber-700/60",
};

// Reserved section key for the Bookmarks group so "expand/collapse all" covers it
// without colliding with a real tag that happens to be named "Bookmarks".
const BOOKMARKS_KEY = " bookmarks";

function Section({
  title,
  open,
  onToggle,
  children,
  tone = "default",
  color,
  action,
  draggable = false,
  dragging = false,
  onDragStart,
  onDrop,
  onDragEnd,
}: {
  title: ReactNode;
  open: boolean;
  onToggle: (open: boolean) => void;
  children: ReactNode;
  tone?: "default" | "bookmark";
  color: SectionPalette;
  // Optional control rendered at the right of the header (e.g. the bookmarks pin toggle).
  action?: ReactNode;
  // Drag-to-reorder support (tag sections only).
  draggable?: boolean;
  dragging?: boolean;
  onDragStart?: () => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
}) {
  const bookmark = tone === "bookmark";
  return (
    <details
      open={open}
      // Fires on user clicks and on programmatic open changes; only write when the
      // DOM state actually diverges from what we intend, avoiding a redundant loop.
      onToggle={(e) => {
        if (e.currentTarget.open !== open) onToggle(e.currentTarget.open);
      }}
      className={cn(
        "group mb-2",
        // Bookmarks get a filled, ringed panel so the section stands out from the tag list.
        bookmark && "rounded-lg bg-amber-50 p-1 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:ring-amber-800/50",
        dragging && "opacity-40",
      )}
    >
      <summary
        draggable={draggable}
        onDragStart={draggable ? onDragStart : undefined}
        onDragOver={draggable ? (e) => e.preventDefault() : undefined}
        onDrop={draggable ? (e) => { e.preventDefault(); onDrop?.(); } : undefined}
        onDragEnd={draggable ? onDragEnd : undefined}
        className={cn(
          "flex cursor-pointer select-none list-none items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-bold uppercase tracking-wide",
          color.header,
        )}
      >
        {draggable && <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab opacity-50 group-hover:opacity-90" />}
        {bookmark && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />}
        {title}
        {action && <span className="ml-auto">{action}</span>}
      </summary>
      {/* Separators live on each row (border-t) rather than divide-y, so the first row is
          bordered too — divide-y only draws rules *between* children, skipping the first. */}
      <div className={cn("mt-1 border-l-2 pl-2", color.border)}>{children}</div>
    </details>
  );
}

export function OperationList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { data: ops = [], isLoading } = useOperations();
  const activeProfile = useStore((s) => s.profiles.find((p) => p.profileId === s.activeProfileId));
  const activeSpecId = useStore((s) => s.activeSpecId);
  const setActiveSpecId = useStore((s) => s.setActiveSpecId);
  const setSelectedOperation = useStore((s) => s.setSelectedOperation);
  const sidebarSections = useStore((s) => s.sidebarSections);
  const setSectionOpen = useStore((s) => s.setSectionOpen);
  const setAllSections = useStore((s) => s.setAllSections);
  const setSidebarScrollTop = useStore((s) => s.setSidebarScrollTop);
  const setBookmarkOrder = useStore((s) => s.setBookmarkOrder);
  const sectionOrder = useStore((s) => s.sectionOrder);
  const setSectionOrder = useStore((s) => s.setSectionOrder);

  // Which bookmark row / section is currently being dragged (for drop target + dimming).
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragTag, setDragTag] = useState<string | null>(null);
  const [modelsOpen, setModelsOpen] = useState(false);
  const specs = useSpecs().data;
  const bookmarksPinned = useStore((s) => s.bookmarksPinned);
  const setBookmarksPinned = useStore((s) => s.setBookmarksPinned);

  // The distinct specs present in the loaded operations, in first-seen (server/config)
  // order. With more than one, the sidebar is scoped to a single spec at a time.
  const availableSpecs = useMemo(() => {
    const seen = new Map<string, string>();
    for (const o of ops) if (!seen.has(o.specId)) seen.set(o.specId, o.specTitle || o.specId);
    return [...seen].map(([specId, title]) => ({ specId, title }));
  }, [ops]);
  const resolvedSpecId =
    activeSpecId && availableSpecs.some((s) => s.specId === activeSpecId)
      ? activeSpecId
      : availableSpecs[0]?.specId ?? null;

  // Everything in the sidebar — bookmarks included — is scoped to the active spec, so
  // switching specs shows only that spec's bookmarks and operations (one spec at a time).
  const visibleOps = resolvedSpecId ? ops.filter((o) => o.specId === resolvedSpecId) : ops;

  const bookmarked = activeProfile ? reconcileBookmarks(activeProfile.operationIds, visibleOps).available : [];
  // Apply the user's saved section order; tags not yet ordered keep their natural (alphabetical) place.
  const groups = applyOrder(groupOperations(visibleOps), (g) => g.tag, sectionOrder);
  const orderedTags = groups.map((g) => g.tag);
  // Adjacency-aware colors so no two neighboring sections share a hue.
  const groupColors = sectionColors(orderedTags);

  const isOpen = (tag: string) => sidebarSections[tag] ?? true; // default open

  const sectionKeys = [...(bookmarked.length > 0 ? [BOOKMARKS_KEY] : []), ...groups.map((g) => g.tag)];
  const allOpen = sectionKeys.length > 0 && sectionKeys.every(isOpen);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Restore the saved scroll offset once, after operations have rendered.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || isLoading || ops.length === 0) return;
    if (scrollRef.current) scrollRef.current.scrollTop = useStore.getState().sidebarScrollTop;
    restored.current = true;
  }, [isLoading, ops.length]);

  // Persist scroll offset, throttled so we don't write to localStorage on every frame.
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    if (scrollTimer.current) return;
    scrollTimer.current = setTimeout(() => {
      scrollTimer.current = null;
      setSidebarScrollTop(top);
    }, 150);
  };

  // Auto-scroll to a newly-selected operation (e.g. chosen from the command palette),
  // expanding its section first. Skipped on the initial mount so scroll restore owns
  // the first paint. Read ops via a ref so this fires only on selection changes.
  const opsRef = useRef(ops);
  opsRef.current = ops;
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!selectedId) return;
    const op = opsRef.current.find((o) => o.id === selectedId);
    if (op) {
      // Bring the selected op's spec into view (it may live in a spec other than the
      // one currently shown, e.g. when chosen from the command palette).
      if (op.specId !== useStore.getState().activeSpecId) setActiveSpecId(op.specId);
      setAllSections(op.tags.length > 0 ? op.tags : ["default"], true);
    }
    requestAnimationFrame(() => {
      const el = scrollRef.current?.querySelector(`[data-op-id="${selectedId}"]`) as HTMLElement | null;
      // Center the selected row in the sidebar rather than just nudging it barely into view.
      el?.scrollIntoView({ block: "center" });
    });
  }, [selectedId]);

  // The bookmarks section (with a pin toggle in its header). Rendered either in the pinned
  // region above the scroller, or inline within the scroller — see below.
  const pinToggle = (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBookmarksPinned(!bookmarksPinned); }}
      aria-label={bookmarksPinned ? "Unpin bookmarks" : "Pin bookmarks"}
      aria-pressed={bookmarksPinned}
      title={bookmarksPinned ? "Unpin bookmarks (scroll with the list)" : "Pin bookmarks to the top"}
      className="rounded p-0.5 text-amber-700 hover:bg-amber-200/60 dark:text-amber-200 dark:hover:bg-amber-800/40"
    >
      {bookmarksPinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
    </button>
  );
  const bookmarksNode = bookmarked.length > 0 ? (
    <Section
      title={`Bookmarks (${bookmarked.length})`}
      tone="bookmark"
      color={BOOKMARK_PALETTE}
      action={pinToggle}
      open={isOpen(BOOKMARKS_KEY)}
      onToggle={(o) => setSectionOpen(BOOKMARKS_KEY, o)}
    >
      {bookmarked.map((op) => (
        <OperationRow
          key={`bm-${op.id}`}
          op={op}
          selected={op.id === selectedId}
          onSelect={onSelect}
          draggable
          dragging={dragId === op.id}
          onDragStart={() => setDragId(op.id)}
          onDrop={() => {
            if (dragId && dragId !== op.id && activeProfile) {
              setBookmarkOrder(reorderById(activeProfile.operationIds, dragId, op.id));
            }
            setDragId(null);
          }}
          onDragEnd={() => setDragId(null)}
        />
      ))}
    </Section>
  ) : null;

  return (
    // Outer column doesn't scroll; the pinned bookmarks region and the operation list below it
    // scroll independently. When pinned, the scroller holds only the tag sections, so
    // scrollIntoView(center) naturally centers a selected op within the non-bookmarks area.
    <div className="flex h-full min-h-0 flex-col">
      {(resolvedSpecId || availableSpecs.length > 1 || sectionKeys.length > 0) && (
        <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface-muted px-3 py-2">
          <SpecInfo specId={resolvedSpecId} />
          {(specs?.find((s) => s.specId === resolvedSpecId)?.schemas?.length ?? 0) > 0 && (
            <button
              onClick={() => setModelsOpen(true)}
              title="Browse models / schemas"
              className="flex items-center gap-1 rounded-md border border-line px-1.5 py-1 text-xs font-medium text-content-secondary hover:bg-surface-muted hover:text-content"
            >
              <Boxes className="h-3.5 w-3.5" /> Models
            </button>
          )}
          {availableSpecs.length > 1 && (
            <select
              aria-label="Spec"
              value={resolvedSpecId ?? ""}
              // Switching spec resets the view — no operation from the old spec stays open/selected.
              onChange={(e) => { setActiveSpecId(e.target.value); setSelectedOperation(null); }}
              className="min-w-0 max-w-[11rem] truncate rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium text-content-secondary outline-none hover:bg-surface-muted focus:border-line-strong"
            >
              {availableSpecs.map((s) => (
                <option key={s.specId} value={s.specId}>{s.title}</option>
              ))}
            </select>
          )}
          {sectionKeys.length > 0 && (
            <button
              onClick={() => setAllSections(sectionKeys, !allOpen)}
              className="ml-auto rounded-md border border-line px-2 py-1 text-xs font-medium text-content-secondary hover:bg-surface-muted hover:text-content dark:hover:text-content"
            >
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
          )}
        </div>
      )}

      {/* Pinned bookmarks: outside the scroller, capped at 30% of the sidebar with its own
          internal scroll so the rest of the API list stays visible. */}
      {bookmarksPinned && bookmarksNode && (
        <div className="shrink-0 overflow-y-auto border-b border-line px-2 pt-2" style={{ maxHeight: "30%" }}>
          {bookmarksNode}
        </div>
      )}

      <div id="sidebar-scroll" ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto p-2">
      {isLoading && <p className="p-3 text-sm text-content-faint">Loading…</p>}

      {!bookmarksPinned && bookmarksNode}

      {groups.map((g, i) => (
        <Section
          key={g.tag}
          title={`${g.tag} (${g.ops.length})`}
          color={groupColors[i]}
          open={isOpen(g.tag)}
          onToggle={(o) => setSectionOpen(g.tag, o)}
          draggable
          dragging={dragTag === g.tag}
          onDragStart={() => setDragTag(g.tag)}
          onDrop={() => {
            if (dragTag && dragTag !== g.tag) setSectionOrder(reorderById(orderedTags, dragTag, g.tag));
            setDragTag(null);
          }}
          onDragEnd={() => setDragTag(null)}
        >
          {g.ops.map((op) => (
            <OperationRow key={`${g.tag}-${op.id}`} op={op} selected={op.id === selectedId} onSelect={onSelect} />
          ))}
        </Section>
      ))}

      {!isLoading && ops.length === 0 && <p className="p-3 text-sm text-content-faint">No operations.</p>}
      </div>
      {modelsOpen && <ModelsBrowser specId={resolvedSpecId} onClose={() => setModelsOpen(false)} />}
    </div>
  );
}

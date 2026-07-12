import { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import { useOperations } from "../../hooks/useOperations.js";
import { useSearch } from "../../hooks/useSearch.js";
import { useStore } from "../../store/store.js";
import { sortByFrequency } from "./frequency.js";
import { splitHighlight } from "./highlight.js";
import { cn } from "../../lib/cn.js";

const METHOD_COLOR: Record<string, string> = {
  GET: "text-method-get", POST: "text-method-post", PUT: "text-method-put",
  PATCH: "text-method-patch", DELETE: "text-danger",
};

function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {splitHighlight(text, query).map((part, i) =>
        part.match ? (
          <mark key={i} className="bg-amber-200 text-content">{part.text}</mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

export function CommandPalette({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const { data: ops = [] } = useOperations();
  const counts = useStore((s) => s.selectionCountsByOperationId);
  const found = useSearch(ops, query);
  // With no query, surface the most-used operations first; while searching, keep the
  // fuzzy relevance order intact.
  const results = (query.trim() ? found : sortByFrequency(found, counts)).slice(0, 50);

  const close = () => {
    onOpenChange(false);
    setQuery("");
  };

  // When the result set changes (typing) or the palette opens, snap the list back to the
  // top. The best match is always the first row, so the top is where we want to be —
  // this avoids a stale scroll position leaving the first result clipped under the input,
  // which cmdk's own scroll-into-view doesn't always correct when results are supplied
  // externally (shouldFilter=false).
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [query, open]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      label="Search operations"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-50 bg-black/40"
      contentClassName="fixed left-1/2 top-[18%] z-50 w-full max-w-xl -translate-x-1/2 px-4"
      className="overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
    >
      <Command.Input
        value={query}
        onValueChange={setQuery}
        placeholder="Search operations…"
        className="w-full border-b border-line bg-transparent px-4 py-3 text-sm text-content outline-none dark:text-content"
      />
      {/* scroll-py-2 gives scrollIntoView() scroll-padding so cmdk's auto-scroll to the
          selected item never tucks the first/last row flush under the input's edge. */}
      <Command.List ref={listRef} className="max-h-80 scroll-py-2 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-content-faint">No operations match.</Command.Empty>
        {results.map((op) => (
          <Command.Item
            key={op.id}
            value={op.id}
            onSelect={() => {
              onSelect(op.id);
              close();
            }}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm aria-selected:bg-accent-subtle"
          >
            <span className={cn("w-12 shrink-0 text-xs font-semibold", METHOD_COLOR[op.method] ?? "text-content-muted")}>{op.method}</span>
            <span className="truncate font-mono text-content"><Highlighted text={op.path} query={query} /></span>
            {op.summary ? (
              <span className="truncate text-xs text-content-faint"><Highlighted text={op.summary} query={query} /></span>
            ) : null}
          </Command.Item>
        ))}
      </Command.List>
    </Command.Dialog>
  );
}

import { useState } from "react";
import { useStore } from "../../store/store.js";
import { useOperations } from "../../hooks/useOperations.js";
import type { HistoryEntry } from "../../store/store.types.js";
import { filterHistory } from "./filterHistory.js";
import { timeAgo } from "./timeAgo.js";
import { cn } from "../../lib/cn.js";

const METHOD_COLOR: Record<string, string> = {
  GET: "text-method-get", POST: "text-method-post", PUT: "text-method-put",
  PATCH: "text-method-patch", DELETE: "text-danger",
};

// Stable empty reference so the selector never returns a fresh [] (which would loop renders).
const NO_HISTORY: HistoryEntry[] = [];

export function HistoryPanel({ onReplay }: { onReplay: (entry: HistoryEntry) => void }) {
  // History is per-profile — show only the active profile's log.
  const history = useStore((s) => s.profiles.find((p) => p.profileId === s.activeProfileId)?.history) ?? NO_HISTORY;
  const clearHistory = useStore((s) => s.clearHistory);
  const { data: ops = [] } = useOperations();
  const [query, setQuery] = useState("");
  const opById = new Map(ops.map((o) => [o.id, o]));
  // Match the operationId AND the visible path/summary (what the user sees in the list).
  const items = filterHistory(history, query, (id) => opById.get(id));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter history…"
          className="flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm dark:text-content"
        />
        <button className="text-xs font-medium text-danger hover:text-danger-strong" onClick={clearHistory}>Clear</button>
      </div>
      <div className="space-y-0.5">
        {items.map((e) => {
          const op = opById.get(e.operationId);
          const method = op?.method ?? "";
          const path = op?.path ?? e.operationId;
          const ok = e.response.status >= 200 && e.response.status < 300;
          return (
            <button
              key={e.id}
              onClick={() => onReplay(e)}
              title="Open this request with its saved inputs and response"
              className="flex w-full items-baseline gap-2 rounded px-1.5 py-0.5 text-left hover:bg-surface-muted"
            >
              {method && <span className={cn("w-9 shrink-0 text-density-secondary font-semibold", METHOD_COLOR[method] ?? "text-content-muted")}>{method}</span>}
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-content">{path}</span>
              <span className={cn("shrink-0 text-density-secondary font-semibold", ok ? "text-success" : "text-danger")}>{e.response.status}</span>
              <span className="shrink-0 text-density-secondary tabular-nums text-content-faint">{timeAgo(e.timestamp)}</span>
            </button>
          );
        })}
        {items.length === 0 && <p className="p-2 text-sm text-content-faint">No history yet.</p>}
      </div>
    </div>
  );
}

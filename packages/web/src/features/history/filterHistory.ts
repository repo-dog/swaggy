import type { HistoryEntry } from "../../store/store.types.js";

/** Resolves an operationId to the human-readable fields the panel shows (path/summary), so the
 * filter matches what the user actually sees — not just the internal operationId. */
type Resolve = (operationId: string) => { path?: string; summary?: string } | undefined;

export function filterHistory(entries: HistoryEntry[], query: string, resolve?: Resolve): HistoryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => {
    if (e.operationId.toLowerCase().includes(q) || String(e.response.status).includes(q)) return true;
    const op = resolve?.(e.operationId);
    return Boolean(op && (op.path?.toLowerCase().includes(q) || op.summary?.toLowerCase().includes(q)));
  });
}

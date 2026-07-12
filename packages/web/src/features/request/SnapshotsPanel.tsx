import { Trash2 } from "lucide-react";
import type { Operation } from "@swaggy/shared";
import { useStore } from "../../store/store.js";
import type { Snapshot } from "../../store/store.types.js";

// Stable empty reference so the selector never returns a fresh [] when no op is selected.
const NO_SNAPSHOTS: Snapshot[] = [];

/** Body of the Snapshots card (the card header/border is provided by the panel wrapper). */
export function SnapshotsPanel({ op, onApply }: { op: Operation | null; onApply: (snap: Snapshot) => void }) {
  const snapshots = useStore((s) => (op ? s.snapshotsByOperationId[op.id] ?? NO_SNAPSHOTS : NO_SNAPSHOTS));
  const deleteSnapshot = useStore((s) => s.deleteSnapshot);

  if (!op) return <p className="text-xs text-content-faint">Select an API to see its snapshots.</p>;
  if (snapshots.length === 0) {
    return <p className="text-xs text-content-faint">No snapshots yet. Send a request, then use “Save as snapshot” to reuse it later.</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {snapshots.map((snap) => (
        <li key={snap.id} className="flex items-center gap-2 py-1.5 first:pt-0">
          <button
            onClick={() => onApply(snap)}
            className="min-w-0 flex-1 truncate text-left text-sm text-content-secondary hover:text-content"
            title="Apply this snapshot"
          >
            {snap.name}
          </button>
          <button
            onClick={() => deleteSnapshot(op.id, snap.id)}
            aria-label={`Delete snapshot ${snap.name}`}
            className="shrink-0 text-danger hover:text-danger-strong"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

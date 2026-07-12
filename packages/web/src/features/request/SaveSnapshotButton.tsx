import { useState } from "react";
import type { Operation } from "@swaggy/shared";
import { useStore } from "../../store/store.js";
import { isDuplicateName } from "../../lib/duplicates.js";
import { cn } from "../../lib/cn.js";
import type { RequestInputs } from "./buildProxyRequest.js";

/** A compact "Save as snapshot" control: a button that expands into an inline name entry. */
export function SaveSnapshotButton({ op, inputs }: { op: Operation; inputs: RequestInputs }) {
  const addSnapshot = useStore((s) => s.addSnapshot);
  const existing = useStore((s) => s.snapshotsByOperationId[op.id] ?? []);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  // Snapshot names are labels, so treat "Prod" and "prod" as the same to avoid confusing dupes.
  const duplicate = isDuplicateName(name, existing.map((s) => s.name), { caseInsensitive: true });

  const save = () => {
    const n = name.trim();
    if (!n || duplicate) return;
    addSnapshot(op.id, n, inputs);
    setName("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-accent/40 px-3 py-2 text-sm font-medium text-accent hover:border-accent hover:bg-accent-subtle"
      >
        Save as snapshot
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); save(); }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Name this snapshot"
          aria-label="Snapshot name"
          aria-invalid={duplicate}
          className={cn(
            "w-44 rounded-md border bg-surface px-2 py-1.5 text-sm outline-none dark:text-content",
            duplicate
              ? "border-danger focus:border-danger"
              : "border-line focus:border-line-strong",
          )}
        />
        <button
          onClick={save}
          disabled={!name.trim() || duplicate}
          className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-contrast hover:bg-accent-strong disabled:opacity-40"
        >
          Save
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md px-2 py-2 text-sm text-content-muted hover:text-content-secondary"
        >
          Cancel
        </button>
      </div>
      {duplicate && <p className="text-[11px] text-danger">A snapshot named “{name.trim()}” already exists.</p>}
    </div>
  );
}

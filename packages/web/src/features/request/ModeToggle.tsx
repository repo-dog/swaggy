import type { Mode } from "../../store/store.types.js";
import { cn } from "../../lib/cn.js";

export function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="inline-flex rounded-md border border-line p-0.5 text-sm">
      {(["simple", "advanced"] as Mode[]).map((m) => {
        // "simple" is the highlighted choice whenever we're not in advanced mode, so a
        // legacy persisted value still lights up the right button.
        const active = m === "advanced" ? mode === "advanced" : mode !== "advanced";
        return (
          <button key={m} onClick={() => onChange(m)}
            className={cn("rounded px-3 py-1 font-medium capitalize", active ? "bg-accent text-accent-contrast" : "text-content-secondary hover:bg-surface-muted")}>
            {m}
          </button>
        );
      })}
    </div>
  );
}

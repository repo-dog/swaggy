import { useEffect, useState } from "react";
import { hardResetApp } from "../../lib/reset.js";
import { ExportProfilesButton } from "../profiles/ExportProfilesButton.js";
import { ImportProfilesButton } from "../profiles/ImportProfilesButton.js";
import { useStore } from "../../store/store.js";

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const simpleLabels = useStore((s) => s.simpleLabels);
  const setSimpleLabels = useStore((s) => s.setSimpleLabels);
  const density = useStore((s) => s.density);
  const setDensity = useStore((s) => s.setDensity);
  const mode = useStore((s) => s.mode);
  const [confirmingReset, setConfirmingReset] = useState(false);

  useEffect(() => {
    if (!open) { setConfirmingReset(false); return; }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="w-full max-w-md rounded-xl border border-line bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-sm font-semibold text-content">Settings</h2>

        <div className="border-t border-line pt-3">
          <p className="mb-2 text-density-sm font-semibold uppercase tracking-wide text-content-muted">Profiles</p>
          <div className="flex items-center gap-4 text-sm text-content-secondary">
            <span className="flex items-center gap-2"><ExportProfilesButton /> Download</span>
            <span className="flex items-center gap-2"><ImportProfilesButton /> Upload</span>
          </div>
          <div className="mt-3">
            {!confirmingReset ? (
              <button
                onClick={() => setConfirmingReset(true)}
                className="text-xs font-medium text-danger hover:text-danger-strong"
              >
                Hard reset…
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-content-muted">
                  This permanently clears <span className="font-medium text-content-secondary">all</span> profiles,
                  history, variables, snapshots, and settings, then reloads Swaggy in its initial state.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={hardResetApp}
                    className="rounded-md bg-danger px-2.5 py-1 text-xs font-medium text-white hover:bg-danger-strong"
                  >
                    Reset everything
                  </button>
                  <button
                    onClick={() => setConfirmingReset(false)}
                    className="text-xs text-content-muted hover:text-content-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-density-sm font-semibold uppercase tracking-wide text-content-muted">Display</p>
          <fieldset>
            <legend className="mb-1.5 text-sm text-content-secondary">Layout density</legend>
            <div className="flex items-center gap-4">
              {(["compact", "comfortable"] as const).map((d) => (
                <label key={d} className="flex cursor-pointer items-center gap-1.5 text-sm text-content-secondary">
                  <input
                    type="radio"
                    name="density"
                    value={d}
                    checked={density === d}
                    onChange={() => setDensity(d)}
                    className="accent-accent"
                  />
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-density-sm font-semibold uppercase tracking-wide text-content-muted">Simple mode</p>
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span className="text-sm text-content-secondary">
              Human-readable field labels
              {mode !== "simple" && (
                <span className="ml-1 text-[11px] text-content-faint">(simple mode only)</span>
              )}
            </span>
            <input
              type="checkbox"
              aria-label="Human-readable field labels"
              checked={simpleLabels}
              onChange={(e) => setSimpleLabels(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

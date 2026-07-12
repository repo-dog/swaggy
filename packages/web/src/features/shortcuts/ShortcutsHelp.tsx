import { useEffect, useState } from "react";
import { hardResetApp } from "../../lib/reset.js";
import { ExportProfilesButton } from "../profiles/ExportProfilesButton.js";
import { ImportProfilesButton } from "../profiles/ImportProfilesButton.js";

const SHORTCUTS: [string, string][] = [
  ["⌘/Ctrl K", "Search operations"],
  ["⌘/Ctrl ↵", "Send request"],
  ["Esc", "Close overlay"],
  ["↑ ↓ / ↵", "Navigate & open results"],
  ["⌘/Ctrl B", "Bookmark current operation"],
  ["⌘/Ctrl \\", "Toggle Simple / Advanced"],
  ["⌘/Ctrl H", "Toggle history section"],
  ["⌘/Ctrl ⇧ C", "Copy response as cURL"],
  ["?", "Show this help"],
];

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  useEffect(() => {
    if (!open) {
      setConfirmingReset(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="w-full max-w-md rounded-xl border border-line bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-sm font-semibold text-content">Keyboard shortcuts</h2>
        <dl className="space-y-1.5">
          {SHORTCUTS.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <dt className="text-content-secondary">{desc}</dt>
              <dd>
                <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-xs text-content-secondary">{key}</kbd>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 border-t border-line pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-muted">Profiles</p>
          <div className="flex items-center gap-4 text-sm text-content-secondary">
            <span className="flex items-center gap-2"><ExportProfilesButton /> Download</span>
            <span className="flex items-center gap-2"><ImportProfilesButton /> Upload</span>
          </div>
        </div>

        <div className="mt-4 border-t border-line pt-3">
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
                This permanently clears <span className="font-medium text-content-secondary">all</span> profiles, history,
                variables, snapshots, and settings, then reloads Swaggy in its initial state.
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
    </div>
  );
}

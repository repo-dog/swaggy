import { useEffect } from "react";

const SHORTCUTS: [string, string][] = [
  ["⌘/Ctrl K", "Search operations"],
  ["⌘/Ctrl ↵", "Send request"],
  ["Esc", "Close overlay"],
  ["↑ ↓ / ↵", "Navigate & open results"],
  ["⌘/Ctrl B", "Bookmark current operation"],
  ["⌘/Ctrl \\", "Toggle Simple / Advanced"],
  ["⌘/Ctrl H", "Toggle history section"],
  ["⌘/Ctrl ⇧ C", "Copy response as cURL"],
  ["⌘/Ctrl ,", "Settings"],
  ["?", "Show this help"],
];

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
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
      </div>
    </div>
  );
}

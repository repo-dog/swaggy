import { useState } from "react";
import { Download } from "lucide-react";
import { useStore } from "../../store/store.js";
import { downloadJson } from "../../lib/download.js";
import { buildProfileExport, exportFilename } from "./profileExport.js";

/** A toolbar button that opens a popover to pick which profiles to export, then downloads
 * their config (bookmarks, common headers, variables) as a shareable JSON file. */
export function ExportProfilesButton() {
  const profiles = useStore((s) => s.profiles);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const openPopover = () => {
    // Default to all profiles selected each time the popover opens.
    setSelected(new Set(profiles.map((p) => p.profileId)));
    setOpen(true);
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = profiles.length > 0 && selected.size === profiles.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(profiles.map((p) => p.profileId)));

  const download = () => {
    const ids = [...selected];
    const envelope = buildProfileExport(profiles, ids);
    downloadJson(exportFilename(envelope.profiles), envelope);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={open ? () => setOpen(false) : openPopover}
        aria-label="Export profiles"
        title="Export profiles"
        aria-expanded={open}
        className="rounded-md border border-line px-2 py-1 text-sm text-content-secondary hover:bg-surface-muted hover:text-content dark:hover:text-content"
      >
        <Download className="h-4 w-4" />
      </button>
      {open && (
        <>
          {/* Click-away backdrop. */}
          <button aria-hidden tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-10 cursor-default" />
          <div className="absolute right-0 z-20 mt-1 w-64 rounded-md border border-line bg-surface p-2 shadow-lg">
            <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-content-muted">Export profiles</p>
            <label className="flex items-center gap-2 rounded px-1 py-1 text-sm text-content-secondary hover:bg-surface-muted">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              <span>Select all</span>
            </label>
            <div className="my-1 max-h-56 overflow-auto border-y border-line py-1">
              {profiles.map((p) => (
                <label
                  key={p.profileId}
                  className="flex items-center gap-2 rounded px-1 py-1 text-sm text-content-secondary hover:bg-surface-muted"
                >
                  <input type="checkbox" checked={selected.has(p.profileId)} onChange={() => toggle(p.profileId)} />
                  <span className="truncate">{p.name}</span>
                </label>
              ))}
            </div>
            <button
              onClick={download}
              disabled={selected.size === 0}
              className="w-full rounded-md bg-accent px-2 py-1 text-sm font-medium text-accent-contrast hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50 dark:bg-surface-muted dark:text-content"
            >
              Download{selected.size > 0 ? ` (${selected.size})` : ""}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useStore } from "../../store/store.js";
import { parseProfileImport } from "./profileExport.js";
import { cn } from "../../lib/cn.js";

type Status = { ok: true; message: string } | { ok: false; message: string } | null;

/** A toolbar button that imports profiles from a previously-exported JSON file. The file is
 * validated, then its config-only profiles are appended (never overwriting existing ones). */
export function ImportProfilesButton() {
  const importProfiles = useStore((s) => s.importProfiles);
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);

  const onFile = async (file: File) => {
    try {
      const profiles = parseProfileImport(await file.text());
      const ids = importProfiles(profiles);
      setStatus({ ok: true, message: `Imported ${ids.length} profile${ids.length === 1 ? "" : "s"}.` });
    } catch (e) {
      setStatus({ ok: false, message: e instanceof Error ? e.message : "Couldn’t import that file." });
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => { setStatus(null); fileRef.current?.click(); }}
        aria-label="Import profiles"
        title="Import profiles"
        className="rounded-md border border-line px-2 py-1 text-sm text-content-secondary hover:bg-surface-muted hover:text-content"
      >
        <Upload className="h-4 w-4" />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        aria-label="Profiles file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset so selecting the same file again re-triggers onChange.
          e.target.value = "";
          if (file) void onFile(file);
        }}
      />
      {status && (
        <>
          <button aria-hidden tabIndex={-1} onClick={() => setStatus(null)} className="fixed inset-0 z-10 cursor-default" />
          <div
            role="status"
            className={cn(
              "absolute right-0 z-20 mt-1 w-64 rounded-md border p-2 text-sm shadow-lg",
              status.ok ? "border-success/40 bg-success/10 text-success" : "border-danger/40 bg-danger-subtle text-danger-strong",
            )}
          >
            {status.message}
          </div>
        </>
      )}
    </div>
  );
}

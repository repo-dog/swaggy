import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useStore } from "../../store/store.js";

// Sentinel option value that starts the "create a new profile" flow from within the dropdown.
const NEW = "__new__";

export function ProfileSwitcher() {
  const profiles = useStore((s) => s.profiles);
  const activeId = useStore((s) => s.activeProfileId);
  const setActive = useStore((s) => s.setActiveProfile);
  const createProfile = useStore((s) => s.createProfile);
  const deleteProfile = useStore((s) => s.deleteProfile);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState(false);

  const activeName = profiles.find((p) => p.profileId === activeId)?.name ?? "";
  // The default profile is permanent — it's the fallback the store falls back to on delete.
  const canDelete = activeId !== "default";

  const submit = () => {
    if (name.trim()) {
      createProfile(name.trim());
      setName("");
      setCreating(false);
    }
  };
  const cancel = () => {
    setName("");
    setCreating(false);
  };

  // Deleting a profile discards its bookmarks, common headers, variables and history, so
  // it's a two-step (trash → confirm) action. The store also refuses to delete "default".
  const remove = () => {
    deleteProfile(activeId);
    setConfirming(false);
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <select
        value={creating ? NEW : activeId}
        onChange={(e) => {
          setConfirming(false);
          if (e.target.value === NEW) {
            setCreating(true);
          } else {
            setCreating(false);
            setActive(e.target.value);
          }
        }}
        className="rounded-md border border-line bg-surface px-2 py-1 text-content dark:text-content"
      >
        {profiles.map((p) => (
          <option key={p.profileId} value={p.profileId}>
            {p.name}
          </option>
        ))}
        <option value={NEW}>+ New profile…</option>
      </select>
      {creating ? (
        <span className="flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              else if (e.key === "Escape") cancel();
            }}
            placeholder="Profile name"
            className="rounded-md border border-line bg-surface px-2 py-1 text-content dark:text-content"
          />
          <button className="rounded bg-accent px-2 py-1 text-white hover:bg-accent-strong dark:bg-surface-muted dark:text-content" onClick={submit}>
            Create
          </button>
          <button className="text-content-faint hover:text-content-secondary" onClick={cancel}>
            Cancel
          </button>
        </span>
      ) : canDelete ? (
        confirming ? (
          <span className="flex items-center gap-1.5">
            <span className="text-xs text-content-muted">Delete “{activeName}”?</span>
            <button
              onClick={remove}
              className="rounded bg-danger px-2 py-1 text-xs font-medium text-white hover:bg-danger-strong"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-xs text-content-muted hover:text-content-secondary"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            aria-label={`Delete profile ${activeName}`}
            title="Delete this profile"
            className="shrink-0 p-1 text-danger hover:text-danger-strong"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )
      ) : null}
    </div>
  );
}

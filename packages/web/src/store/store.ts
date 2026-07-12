import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthValue, CommonHeader, HistoryEntry, Mode, Profile, RequestInputs, Snapshot, StoredResponse, Theme } from "./store.types.js";
import { nextTheme } from "../lib/theme.js";

export const HISTORY_CAP = 200;
export const MAX_BODY_BYTES = 262144;
// Cap the number of operations whose filled-in inputs / last response we retain,
// so heavy use can't grow localStorage without bound. Oldest-touched are evicted.
export const INPUTS_CAP = 100;
export const RESPONSES_CAP = 50;
export const SNAPSHOTS_PER_OP = 50;
export const SCHEMA_VERSION = 1;
// Default sidebar widths (also the target when a resize handle is double-clicked to reset).
export const DEFAULT_LEFT_SIDEBAR_WIDTH = 420;
export const DEFAULT_RIGHT_SIDEBAR_WIDTH = 420;

/** Insert/refresh a key at the end of an ordered map, evicting oldest keys past `cap`. */
function capMap<T>(map: Record<string, T>, key: string, value: T, cap: number): Record<string, T> {
  const next = { ...map };
  delete next[key]; // re-insert so the key moves to the most-recent position
  next[key] = value;
  const keys = Object.keys(next);
  for (const k of keys.slice(0, Math.max(0, keys.length - cap))) delete next[k];
  return next;
}

let counter = 0;
const genId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

type State = {
  schemaVersion: number;
  profiles: Profile[];
  activeProfileId: string;
  mode: Mode;
  theme: Theme;
  serverChoiceBySpecId: Record<string, string>;
  // UI state persisted so a refresh restores where the user left off.
  selectedOperationId: string | null;
  // How often each operation has been opened, so the palette can surface favorites first.
  selectionCountsByOperationId: Record<string, number>;
  // Which spec the sidebar is scoped to (null = not yet chosen → resolves to the first
  // available spec). With multiple specs the sidebar shows one at a time, not merged.
  activeSpecId: string | null;
  sidebarSections: Record<string, boolean>; // per-section open state; a missing key means open
  sectionOrder: string[]; // user-defined tag order for the sidebar; unlisted tags sort last
  // Open/closed state of the request-side collapsible cards (Auth, Variables). A missing
  // key means closed — these default collapsed.
  sidePanelSections: Record<string, boolean>;
  // User-defined order of the right-panel cards (by key); unlisted keys keep their default
  // order. Empty = default order.
  sidePanelOrder: string[];
  // Per-card body height in px (keyed by card key); a missing key uses the default height.
  sidePanelHeights: Record<string, number>;
  sidebarScrollTop: number;
  // Keep the Bookmarks section pinned above the scrolling operation list (default on). When
  // pinned it's capped at 30% of the sidebar height and scrolls internally.
  bookmarksPinned: boolean;
  // Resizable/collapsible sidebar layout. Widths are in px; the UI caps them at 30% of the
  // viewport at drag time. Persisted so the layout survives refresh.
  leftSidebarWidth: number;
  rightSidebarWidth: number;
  leftSidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
  inputsByOperationId: Record<string, RequestInputs>;
  lastResponseByOperationId: Record<string, StoredResponse>;
  snapshotsByOperationId: Record<string, Snapshot[]>;
};

type Actions = {
  createProfile: (name: string) => string;
  // Append config-only profiles (no history/credentials) from an imported file, giving each a
  // fresh id and a de-duplicated name. Returns the new ids.
  importProfiles: (profiles: Omit<Profile, "history" | "authValues">[]) => string[];
  deleteProfile: (id: string) => void;
  setActiveProfile: (id: string) => void;
  toggleBookmark: (operationId: string) => void;
  setBookmarkOrder: (operationIds: string[]) => void;
  isBookmarked: (operationId: string) => boolean;
  setVariable: (name: string, value: string) => void;
  deleteVariable: (name: string) => void;
  setVariables: (variables: Record<string, string>) => void;
  setMode: (mode: Mode) => void;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setServerChoice: (specId: string, server: string) => void;
  setCommonHeaders: (headers: CommonHeader[]) => void;
  setAuthValue: (schemeKey: string, value: AuthValue) => void;
  addHistory: (entry: Omit<HistoryEntry, "id" | "timestamp">) => void;
  clearHistory: () => void;
  setSelectedOperation: (id: string | null) => void;
  setActiveSpecId: (id: string | null) => void;
  setSectionOpen: (tag: string, open: boolean) => void;
  setAllSections: (tags: string[], open: boolean) => void;
  setSectionOrder: (tags: string[]) => void;
  setSidePanelSection: (key: string, open: boolean) => void;
  setSidePanelOrder: (order: string[]) => void;
  setSidePanelHeight: (key: string, height: number) => void;
  setSidebarScrollTop: (top: number) => void;
  setBookmarksPinned: (pinned: boolean) => void;
  setLeftSidebarWidth: (width: number) => void;
  setRightSidebarWidth: (width: number) => void;
  setLeftSidebarCollapsed: (collapsed: boolean) => void;
  setRightSidebarCollapsed: (collapsed: boolean) => void;
  setInputs: (operationId: string, inputs: RequestInputs) => void;
  clearInputs: (operationId: string) => void;
  setLastResponse: (operationId: string, response: StoredResponse) => void;
  clearResponse: (operationId: string) => void;
  addSnapshot: (operationId: string, name: string, inputs: RequestInputs) => string;
  deleteSnapshot: (operationId: string, snapshotId: string) => void;
  renameSnapshot: (operationId: string, snapshotId: string, name: string) => void;
};

const initial: State = {
  schemaVersion: SCHEMA_VERSION,
  profiles: [{ profileId: "default", name: "Default", operationIds: [], commonHeaders: [], variables: {}, history: [] }],
  activeProfileId: "default",
  mode: "advanced",
  theme: "system",
  serverChoiceBySpecId: {},
  selectedOperationId: null,
  selectionCountsByOperationId: {},
  activeSpecId: null,
  sidebarSections: {},
  sectionOrder: [],
  sidePanelSections: {},
  sidePanelOrder: [],
  sidePanelHeights: {},
  sidebarScrollTop: 0,
  bookmarksPinned: true,
  leftSidebarWidth: DEFAULT_LEFT_SIDEBAR_WIDTH,
  rightSidebarWidth: DEFAULT_RIGHT_SIDEBAR_WIDTH,
  leftSidebarCollapsed: false,
  rightSidebarCollapsed: false,
  inputsByOperationId: {},
  lastResponseByOperationId: {},
  snapshotsByOperationId: {},
};

function truncateBody(body: unknown): { body: unknown; truncated: boolean } {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  if (text !== undefined && text.length > MAX_BODY_BYTES) {
    return { body: text.slice(0, MAX_BODY_BYTES), truncated: true };
  }
  return { body, truncated: false };
}

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...initial,

      createProfile: (name) => {
        const id = genId();
        set((st) => ({
          profiles: [...st.profiles, { profileId: id, name, operationIds: [], commonHeaders: [], variables: {}, history: [] }],
          activeProfileId: id,
        }));
        return id;
      },

      importProfiles: (imported) => {
        const st = get();
        // Never collide with (or overwrite) an existing profile: fresh id, and a name suffixed
        // " (2)", " (3)"… when the imported name is already taken (case-insensitively).
        const taken = new Set(st.profiles.map((p) => p.name.trim().toLowerCase()));
        const ids: string[] = [];
        const added: Profile[] = imported.map((p) => {
          let name = p.name.trim() || "Imported profile";
          if (taken.has(name.toLowerCase())) {
            let n = 2;
            while (taken.has(`${name} (${n})`.toLowerCase())) n++;
            name = `${name} (${n})`;
          }
          taken.add(name.toLowerCase());
          const id = genId();
          ids.push(id);
          return {
            profileId: id,
            name,
            operationIds: p.operationIds ?? [],
            commonHeaders: p.commonHeaders ?? [],
            variables: p.variables ?? {},
            history: [],
          };
        });
        set({ profiles: [...st.profiles, ...added], activeProfileId: ids[0] ?? st.activeProfileId });
        return ids;
      },

      deleteProfile: (id) => {
        if (id === "default") return;
        set((st) => ({
          profiles: st.profiles.filter((p) => p.profileId !== id),
          activeProfileId: st.activeProfileId === id ? "default" : st.activeProfileId,
        }));
      },

      setActiveProfile: (id) => set({ activeProfileId: id }),

      toggleBookmark: (operationId) =>
        set((st) => ({
          profiles: st.profiles.map((p) => {
            if (p.profileId !== st.activeProfileId) return p;
            const has = p.operationIds.includes(operationId);
            return { ...p, operationIds: has ? p.operationIds.filter((o) => o !== operationId) : [...p.operationIds, operationId] };
          }),
        })),

      setBookmarkOrder: (operationIds) =>
        set((st) => ({
          profiles: st.profiles.map((p) =>
            p.profileId === st.activeProfileId ? { ...p, operationIds } : p,
          ),
        })),

      isBookmarked: (operationId) => {
        const p = get().profiles.find((pr) => pr.profileId === get().activeProfileId);
        return Boolean(p?.operationIds.includes(operationId));
      },

      setVariable: (name, value) =>
        set((st) => ({
          profiles: st.profiles.map((p) =>
            p.profileId === st.activeProfileId ? { ...p, variables: { ...(p.variables ?? {}), [name]: value } } : p,
          ),
        })),

      deleteVariable: (name) =>
        set((st) => ({
          profiles: st.profiles.map((p) => {
            if (p.profileId !== st.activeProfileId) return p;
            const variables = { ...(p.variables ?? {}) };
            delete variables[name];
            return { ...p, variables };
          }),
        })),

      setVariables: (variables) =>
        set((st) => ({
          profiles: st.profiles.map((p) => (p.profileId === st.activeProfileId ? { ...p, variables } : p)),
        })),

      setMode: (mode) => set({ mode }),

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((st) => ({ theme: nextTheme(st.theme) })),

      setServerChoice: (specId, server) =>
        set((st) => ({ serverChoiceBySpecId: { ...st.serverChoiceBySpecId, [specId]: server } })),

      setCommonHeaders: (headers) =>
        set((st) => ({
          profiles: st.profiles.map((p) => (p.profileId === st.activeProfileId ? { ...p, commonHeaders: headers } : p)),
        })),

      setAuthValue: (schemeKey, value) =>
        set((st) => ({
          profiles: st.profiles.map((p) =>
            p.profileId === st.activeProfileId
              ? { ...p, authValues: { ...(p.authValues ?? {}), [schemeKey]: value } }
              : p,
          ),
        })),

      addHistory: (entry) => {
        const { body, truncated } = truncateBody(entry.response.body);
        const full: HistoryEntry = {
          ...entry,
          id: genId(),
          timestamp: Date.now(),
          response: { ...entry.response, body, bodyTruncated: entry.response.bodyTruncated || truncated },
        };
        set((st) => ({
          profiles: st.profiles.map((p) =>
            p.profileId === st.activeProfileId
              ? { ...p, history: [full, ...(p.history ?? [])].slice(0, HISTORY_CAP) }
              : p,
          ),
        }));
      },

      clearHistory: () =>
        set((st) => ({
          profiles: st.profiles.map((p) => (p.profileId === st.activeProfileId ? { ...p, history: [] } : p)),
        })),

      setSelectedOperation: (id) =>
        set((st) => {
          if (id === null) return { selectedOperationId: null };
          // Count each explicit selection (sidebar, palette, replay) so the palette
          // can rank by frequency. Refresh-time restore reads state directly and
          // never routes through here, so it doesn't inflate counts.
          return {
            selectedOperationId: id,
            selectionCountsByOperationId: {
              ...st.selectionCountsByOperationId,
              [id]: (st.selectionCountsByOperationId[id] ?? 0) + 1,
            },
          };
        }),

      setActiveSpecId: (id) => set({ activeSpecId: id }),

      setSectionOpen: (tag, open) =>
        set((st) => ({ sidebarSections: { ...st.sidebarSections, [tag]: open } })),

      setAllSections: (tags, open) =>
        set((st) => {
          const sidebarSections = { ...st.sidebarSections };
          for (const tag of tags) sidebarSections[tag] = open;
          return { sidebarSections };
        }),

      setSectionOrder: (tags) => set({ sectionOrder: tags }),

      setSidebarScrollTop: (top) => set({ sidebarScrollTop: top }),
      setBookmarksPinned: (pinned) => set({ bookmarksPinned: pinned }),

      setLeftSidebarWidth: (width) => set({ leftSidebarWidth: width }),
      setRightSidebarWidth: (width) => set({ rightSidebarWidth: width }),
      setLeftSidebarCollapsed: (collapsed) => set({ leftSidebarCollapsed: collapsed }),
      setRightSidebarCollapsed: (collapsed) => set({ rightSidebarCollapsed: collapsed }),

      setSidePanelSection: (key, open) =>
        set((st) => ({ sidePanelSections: { ...st.sidePanelSections, [key]: open } })),
      setSidePanelOrder: (order) => set({ sidePanelOrder: order }),
      setSidePanelHeight: (key, height) =>
        set((st) => ({ sidePanelHeights: { ...st.sidePanelHeights, [key]: height } })),

      setInputs: (operationId, inputs) =>
        set((st) => ({ inputsByOperationId: capMap(st.inputsByOperationId, operationId, inputs, INPUTS_CAP) })),

      clearInputs: (operationId) =>
        set((st) => {
          if (!(operationId in st.inputsByOperationId)) return {};
          const next = { ...st.inputsByOperationId };
          delete next[operationId];
          return { inputsByOperationId: next };
        }),

      setLastResponse: (operationId, response) =>
        set((st) => {
          let stored = response;
          if (response.kind === "result" && response.result.ok) {
            const { body } = truncateBody(response.result.response.body);
            stored = { kind: "result", result: { ...response.result, response: { ...response.result.response, body } } };
          }
          return { lastResponseByOperationId: capMap(st.lastResponseByOperationId, operationId, stored, RESPONSES_CAP) };
        }),

      clearResponse: (operationId) =>
        set((st) => {
          if (!(operationId in st.lastResponseByOperationId)) return {};
          const next = { ...st.lastResponseByOperationId };
          delete next[operationId];
          return { lastResponseByOperationId: next };
        }),

      addSnapshot: (operationId, name, inputs) => {
        const id = genId();
        set((st) => {
          const list = st.snapshotsByOperationId[operationId] ?? [];
          // Newest first; cap per operation so a single API can't grow unbounded.
          const next = [{ id, name, createdAt: Date.now(), inputs }, ...list].slice(0, SNAPSHOTS_PER_OP);
          return { snapshotsByOperationId: { ...st.snapshotsByOperationId, [operationId]: next } };
        });
        return id;
      },

      deleteSnapshot: (operationId, snapshotId) =>
        set((st) => {
          const list = st.snapshotsByOperationId[operationId];
          if (!list) return {};
          return {
            snapshotsByOperationId: { ...st.snapshotsByOperationId, [operationId]: list.filter((x) => x.id !== snapshotId) },
          };
        }),

      renameSnapshot: (operationId, snapshotId, name) =>
        set((st) => {
          const list = st.snapshotsByOperationId[operationId];
          if (!list) return {};
          return {
            snapshotsByOperationId: {
              ...st.snapshotsByOperationId,
              [operationId]: list.map((x) => (x.id === snapshotId ? { ...x, name } : x)),
            },
          };
        }),
    }),
    {
      name: "swaggy.store",
      version: SCHEMA_VERSION,
      // Don't persist the selected operation: the shareable `?op=` URL is the source of truth
      // for what's open, so a fresh load (no `?op`) starts on the empty state rather than
      // silently reopening the last-viewed operation.
      partialize: (state) => {
        const { selectedOperationId: _selectedOperationId, ...rest } = state;
        return rest as typeof state;
      },
    },
  ),
);

import { useEffect, useRef, useState } from "react";
import { Moon, Sun, Monitor, Compass } from "lucide-react";
import { OperationList } from "./features/operations/OperationList.js";
import { RequestPanel } from "./features/request/RequestPanel.js";
import { SidePanels } from "./features/request/SidePanels.js";
import { ProfileSwitcher } from "./features/profiles/ProfileSwitcher.js";
import { ResizableSidebar } from "./features/layout/ResizableSidebar.js";
import { CommandPalette } from "./features/palette/CommandPalette.js";
import { ShortcutsHelp } from "./features/shortcuts/ShortcutsHelp.js";
import { useGlobalShortcuts } from "./features/shortcuts/useGlobalShortcuts.js";
import { useOperations } from "./hooks/useOperations.js";
import { readOpFromSearch, writeOpToSearch } from "./features/navigation/opUrl.js";
import { useStore, DEFAULT_LEFT_SIDEBAR_WIDTH } from "./store/store.js";
import { resolveTheme, nextTheme, onSystemThemeChange } from "./lib/theme.js";
import type { HistoryEntry } from "./store/store.types.js";

const THEME_ICON = { system: Monitor, light: Sun, dark: Moon } as const;

/** Scroll the sidebar list and the detail view back to the top. */
function scrollToTop() {
  for (const id of ["sidebar-scroll", "detail-scroll"]) {
    document.getElementById(id)?.scrollTo?.({ top: 0, behavior: "smooth" });
  }
}

export default function App() {
  const selectedId = useStore((s) => s.selectedOperationId);
  const setSelectedId = useStore((s) => s.setSelectedOperation);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [replaySeed, setReplaySeed] = useState<HistoryEntry | null>(null);
  const { data: ops = [] } = useOperations();
  const selected = ops.find((o) => o.id === selectedId) ?? null;

  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const toggleBookmark = useStore((s) => s.toggleBookmark);
  const setLastResponse = useStore((s) => s.setLastResponse);
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const leftWidth = useStore((s) => s.leftSidebarWidth);
  const setLeftWidth = useStore((s) => s.setLeftSidebarWidth);
  const leftCollapsed = useStore((s) => s.leftSidebarCollapsed);
  const setLeftCollapsed = useStore((s) => s.setLeftSidebarCollapsed);

  // Reflect the resolved theme onto <html> so Tailwind's `dark:` variants apply.
  // When following the OS ("system"), re-apply live as the OS switches light/dark.
  useEffect(() => {
    const apply = () => document.documentElement.classList.toggle("dark", resolveTheme(theme) === "dark");
    apply();
    if (theme !== "system") return;
    return onSystemThemeChange(apply);
  }, [theme]);

  // --- Shareable URLs: keep the selected operation in the `?op=` query param ---
  // On mount, open whatever the URL points at (a shared link), or nothing — the selection
  // isn't persisted, so a bare load lands on the empty state.
  useEffect(() => {
    setSelectedId(readOpFromSearch(window.location.search));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selection → URL. The URL is authoritative on load, so the first run writes nothing;
  // afterwards each selection change pushes so Back/Forward navigate between opened operations.
  const firstUrlSync = useRef(true);
  useEffect(() => {
    if (firstUrlSync.current) {
      firstUrlSync.current = false;
      return;
    }
    const current = readOpFromSearch(window.location.search);
    if (current === (selectedId ?? null)) return;
    const url = window.location.pathname + writeOpToSearch(window.location.search, selectedId ?? null);
    window.history.pushState(null, "", url);
  }, [selectedId]);

  // Back/Forward → selection. The browser has already updated the URL, so the sync effect
  // above sees them equal and won't push again.
  useEffect(() => {
    const onPop = () => setSelectedId(readOpFromSearch(window.location.search));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [setSelectedId]);

  // Reopen a history entry: select its operation, seed the request inputs it was sent
  // with, and restore the response captured at that time so the panel shows both.
  const replayHistory = (entry: HistoryEntry) => {
    setSelectedId(entry.operationId);
    setReplaySeed(entry);
    const text = typeof entry.response.body === "string" ? entry.response.body : JSON.stringify(entry.response.body ?? null);
    setLastResponse(entry.operationId, {
      kind: "result",
      result: {
        ok: true,
        response: {
          status: entry.response.status,
          statusText: "",
          headers: entry.response.headers,
          body: entry.response.body,
          durationMs: entry.durationMs,
          bodySize: new TextEncoder().encode(text).length,
        },
      },
    });
  };

  useGlobalShortcuts({
    palette: () => setPaletteOpen(true),
    // Toggle the History side-panel card (read live state so the closure never goes stale).
    toggleHistory: () => {
      const cur = useStore.getState().sidePanelSections["history"] ?? false;
      useStore.getState().setSidePanelSection("history", !cur);
    },
    toggleMode: () => setMode(mode === "advanced" ? "simple" : "advanced"),
    toggleBookmark: () => {
      if (selected) toggleBookmark(selected.id);
    },
    cheatsheet: () => setShowHelp(true),
  });

  return (
    <div className="flex h-screen flex-col bg-canvas text-content">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2">
        <button
          onClick={scrollToTop}
          title="Scroll to top"
          className="flex items-center gap-2 font-semibold tracking-tight text-content hover:text-content-secondary"
        >
          <img src="/favicon.svg" alt="" aria-hidden className="h-5 w-5" />
          Swaggy
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-2 rounded-md border border-line px-3 py-1 text-sm text-content-secondary hover:bg-surface-muted hover:text-content"
          >
            Search operations
            <kbd className="rounded border border-line bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-content-secondary">⌘K</kbd>
          </button>
          <ProfileSwitcher />
          {(() => {
            const ThemeIcon = THEME_ICON[theme];
            return (
              <button
                onClick={toggleTheme}
                className="rounded-md border border-line px-2 py-1 text-sm text-content-secondary hover:bg-surface-muted hover:text-content"
                title={`Theme: ${theme}`}
                aria-label={`Theme: ${theme}. Switch to ${nextTheme(theme)} mode.`}
              >
                <ThemeIcon className="h-4 w-4" />
              </button>
            );
          })()}
          <button
            onClick={() => setShowHelp(true)}
            className="rounded-md border border-line px-2 py-1 text-sm text-content-secondary hover:bg-surface-muted hover:text-content"
            aria-label="Keyboard shortcuts"
          >
            ?
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex min-h-0 flex-1">
        <ResizableSidebar
          side="left"
          label="Operations"
          width={leftWidth}
          onWidth={setLeftWidth}
          defaultWidth={DEFAULT_LEFT_SIDEBAR_WIDTH}
          collapsed={leftCollapsed}
          onCollapsedChange={setLeftCollapsed}
        >
          <OperationList selectedId={selectedId} onSelect={setSelectedId} />
        </ResizableSidebar>
        {/* No padding on main itself: the right panel is a child here (unlike the left
            sidebar), so main padding would inset it from the browser edge. Padding lives on the
            content columns instead, leaving the panel rail flush to the edge. */}
        <main className="min-h-0 flex-1 overflow-hidden">
          {selected ? (
            <RequestPanel op={selected} replaySeed={replaySeed} onReplay={replayHistory} />
          ) : (
            // Keep the right panel mounted with no operation selected — its profile-level cards
            // still work, and the op-scoped ones prompt to pick an API.
            <div className="flex h-full">
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 py-6 pl-6 pr-6 text-center">
                <div className="rounded-full bg-surface-muted p-5 ring-1 ring-line">
                  <Compass className="h-10 w-10 text-content-faint" />
                </div>
                <div>
                  <p className="text-base font-semibold text-content">No operation selected</p>
                  <p className="mt-1 text-sm text-content-muted">
                    Pick one from the sidebar, or press{" "}
                    <kbd className="rounded border border-line bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-content-secondary">⌘K</kbd>{" "}
                    to search.
                  </p>
                </div>
              </div>
              <SidePanels op={null} onReplay={replayHistory} />
            </div>
          )}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onSelect={setSelectedId} />
      <ShortcutsHelp open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}

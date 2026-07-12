import type { Theme } from "../store/store.types.js";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Whether the OS currently prefers dark. Safe when matchMedia is unavailable (SSR/tests). */
export function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(DARK_QUERY).matches
    : false;
}

/** Collapse a Theme (which may be "system") to the concrete light/dark actually rendered. */
export function resolveTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? (systemPrefersDark() ? "dark" : "light") : theme;
}

/** Next theme when cycling the toggle: system → light → dark → system. */
export function nextTheme(theme: Theme): Theme {
  return theme === "system" ? "light" : theme === "light" ? "dark" : "system";
}

/** Subscribe to OS light/dark changes. Returns an unsubscribe fn (no-op if unsupported). */
export function onSystemThemeChange(cb: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

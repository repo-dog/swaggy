export type ShortcutAction =
  | "palette"
  | "toggleHistory"
  | "toggleMode"
  | "toggleBookmark"
  | "cheatsheet";

export type KeyEventLike = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
};

/**
 * Map a keyboard event to a global shortcut action, or null. `mod` is
 * meta (cmd) OR ctrl so mac and other platforms both work. The plain `?`
 * shortcut only fires when focus is not in an editable field.
 *
 * mod+Enter (send) and mod+Shift+C (copy cURL) are handled locally in
 * SendBar because they need request/response context, so they are not here.
 */
export function resolveShortcut(e: KeyEventLike, inEditable: boolean): ShortcutAction | null {
  const mod = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();

  if (mod && key === "k") return "palette";
  if (mod && key === "h") return "toggleHistory";
  if (mod && key === "\\") return "toggleMode";
  if (mod && key === "b") return "toggleBookmark";
  if (!mod && !inEditable && e.key === "?") return "cheatsheet";

  return null;
}

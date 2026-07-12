import { useEffect, useRef } from "react";
import { resolveShortcut, type ShortcutAction } from "./resolveShortcut.js";

function isEditable(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  return node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.isContentEditable === true;
}

/**
 * Register global keyboard shortcuts. Handlers are read through a ref so the
 * listener is installed once but always calls the latest closures.
 */
export function useGlobalShortcuts(handlers: Partial<Record<ShortcutAction, () => void>>): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = resolveShortcut(e, isEditable(document.activeElement));
      if (!action) return;
      const handler = ref.current[action];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

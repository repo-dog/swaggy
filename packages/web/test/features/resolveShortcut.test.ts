import { describe, it, expect } from "vitest";
import { resolveShortcut } from "../../src/features/shortcuts/resolveShortcut.js";

const ev = (over: Partial<{ key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }>) => ({
  key: "", metaKey: false, ctrlKey: false, shiftKey: false, ...over,
});

describe("resolveShortcut", () => {
  it("maps mod+K (cmd or ctrl) to the palette", () => {
    expect(resolveShortcut(ev({ key: "k", metaKey: true }), false)).toBe("palette");
    expect(resolveShortcut(ev({ key: "K", ctrlKey: true }), false)).toBe("palette");
  });

  it("maps the other modifier combos", () => {
    expect(resolveShortcut(ev({ key: "h", metaKey: true }), false)).toBe("toggleHistory");
    expect(resolveShortcut(ev({ key: "\\", ctrlKey: true }), false)).toBe("toggleMode");
    expect(resolveShortcut(ev({ key: "b", metaKey: true }), false)).toBe("toggleBookmark");
  });

  it("fires ? for the cheat sheet only outside editable fields", () => {
    expect(resolveShortcut(ev({ key: "?" }), false)).toBe("cheatsheet");
    expect(resolveShortcut(ev({ key: "?" }), true)).toBeNull();
  });

  it("returns null for unrelated keys", () => {
    expect(resolveShortcut(ev({ key: "a", metaKey: true }), false)).toBeNull();
    expect(resolveShortcut(ev({ key: "k" }), false)).toBeNull();
  });
});

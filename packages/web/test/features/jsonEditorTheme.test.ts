import { describe, it, expect } from "vitest";
import { jsonEditorTheme } from "../../src/features/request/jsonEditorTheme.js";

describe("jsonEditorTheme", () => {
  it("returns a theme + syntax-highlight extension pair for both app themes", () => {
    for (const dark of [true, false]) {
      const ext = jsonEditorTheme(dark);
      expect(Array.isArray(ext)).toBe(true);
      // container theme + syntaxHighlighting(highlightStyle)
      expect(ext).toHaveLength(2);
      expect(ext.every(Boolean)).toBe(true);
    }
  });
});

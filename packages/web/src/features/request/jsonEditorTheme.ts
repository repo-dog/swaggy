import { EditorView } from "@uiw/react-codemirror";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@uiw/react-codemirror";

// Token colors mirror the response JSON tree (JsonView) so the request-body editor and the
// response body read as the same surface: keys sky, strings emerald, numbers amber, booleans
// violet, null slate. Kept in one place so the two views can't drift apart.
const KEY = "#7dd3fc"; // sky-300
const STRING = "#6ee7b7"; // emerald-300
const NUMBER = "#fcd34d"; // amber-300
const BOOL = "#c4b5fd"; // violet-300
const NULLISH = "#94a3b8"; // slate-400
const PUNCT = "#64748b"; // slate-500
const TEXT = "#f1f5f9"; // slate-100

const highlight = HighlightStyle.define([
  { tag: t.propertyName, color: KEY },
  { tag: t.string, color: STRING },
  { tag: t.number, color: NUMBER },
  { tag: t.bool, color: BOOL },
  { tag: t.null, color: NULLISH },
  { tag: [t.separator, t.squareBracket, t.brace, t.punctuation], color: PUNCT },
  { tag: t.invalid, color: "#f87171" }, // red-400
]);

/** CodeMirror theme matching the response JsonView: a dark slate surface with the same JSON
 * token colors. `dark` picks the exact background JsonView uses per app theme (slate-900 in
 * light mode, slate-950 in dark) so the two bodies sit on the identical surface. */
export function jsonEditorTheme(dark: boolean): Extension[] {
  const bg = dark ? "#020617" : "#0f172a"; // slate-950 / slate-900 (matches JsonView)
  const container = EditorView.theme(
    {
      "&": { backgroundColor: bg, color: TEXT, fontSize: "12px" },
      ".cm-content": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
      ".cm-gutters": { backgroundColor: bg, color: "#475569", border: "none" },
      ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.04)" },
      ".cm-activeLineGutter": { backgroundColor: "rgba(255,255,255,0.04)" },
      "&.cm-focused": { outline: "none" },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#e2e8f0" },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: "rgba(148,163,184,0.28)",
      },
    },
    { dark: true },
  );
  return [container, syntaxHighlighting(highlight)];
}

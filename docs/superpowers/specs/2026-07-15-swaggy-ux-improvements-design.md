# Swaggy UX Improvements — Design Spec

**Date:** 2026-07-15

## Overview

Seven related improvements to the Swaggy UI: a global Simple/Advanced mode toggle, human-friendly Simple mode presentation, a persistent sidebar search, a Settings panel, two JSON response viewer fixes (alignment and filter behavior), and proper rendering of HTML-in-markdown operation descriptions.

---

## 1. Global mode toggle

**Current state:** `ModeToggle` is rendered inside `RequestPanel`, making it per-operation and visually buried.

**Change:** Move `ModeToggle` to the `App.tsx` top bar, between the `⌘K` search button and `ProfileSwitcher`. Remove the toggle from `RequestPanel`. The existing `⌘\` keyboard shortcut is unchanged.

**Rationale:** Mode is a global preference, not per-operation. Living in the top bar makes it always visible and reinforces its global scope.

---

## 2. Settings panel

A new gear icon button in the top bar, to the left of the `?` button, opens a modal dialog (same style as `ShortcutsHelp`).

### New store fields

| Field | Type | Default | Description |
|---|---|---|---|
| `simpleLabels` | `boolean` | `true` | Humanize field labels in Simple mode |
| `sidebarSearch` | `string` | `""` | Persistent sidebar search query |

Both are persisted via Zustand's `persist` middleware.

### Settings dialog sections

**Profiles section** (moved verbatim from `ShortcutsHelp`):
- Export profiles button (Download)
- Import profiles button (Upload)
- Hard reset button (with two-step confirmation)

These are **removed** from the `?` shortcuts panel.

**Simple mode section:**
- Toggle labeled "Human-readable field labels" — converts `camelCase`/`snake_case` field names to sentence case (e.g. `phoneNumber` → `Phone number`). Only effective when `mode === "simple"`; the toggle is visible in Advanced mode but noted as Simple-mode-only.

---

## 3. Simple mode UX

### 3a. Humanized field labels

New utility `humanizeLabel(str: string): string`:
- Splits on `_` and camelCase boundaries
- Lowercases all parts
- Capitalizes the first word only
- Joins with spaces

Examples: `phoneNumber` → `Phone number`, `user_id` → `User id`, `firstName` → `First name`.

**Applied when** `mode === "simple"` AND `simpleLabels === true`:
1. RJSF `FieldTemplate` (`rjsf/theme.tsx`) — wraps the `label` prop before rendering
2. `ParamFields.tsx` — wraps each field name label before display

Both components read `mode` and `simpleLabels` from the store directly.

### 3b. OperationRow in Simple mode

| Mode | Primary label | Subtext |
|---|---|---|
| Advanced (current) | `op.path` (mono) | `op.summary` (faint) |
| Simple | `op.summary ?? op.description ?? op.path` (truncated ~60 chars, ellipsis) | `op.path` (mono, faint) |

`OperationRow` reads `mode` from the store.

### 3c. CommandPalette in Simple mode

Same swap as `OperationRow`: `op.summary ?? op.description ?? op.path` as the main label, `op.path` as secondary faint text. `CommandPalette` reads `mode` from the store.

---

## 4. Sidebar search

A plain text `<input>` added to `OperationList`, immediately below the existing spec/collapse toolbar, reads/writes `sidebarSearch` from the store (persisted).

**Filter behavior:**
- Case-insensitive match against `op.path`, `op.summary`, and `op.description`
- Sections keep their grouping; non-matching rows are hidden within each section
- A section with zero visible rows is hidden entirely (header suppressed)
- Bookmarks section follows the same rule

**Highlighting:** matching text in each row's primary label and path subtext is highlighted using the existing `splitHighlight` utility (amber `<mark>` style, same as command palette). Applied to both `OperationRow`'s primary text and path line when a query is active.

**Relation to ⌘K:** the sidebar search is a persistent filter for narrowing the list; the command palette remains a quick-jump overlay. They are independent.

---

## 5. Response JSON viewer fixes

### 5a. Key alignment

**Problem:** object/array nodes render a chevron button (`w-3` icon + `mr-0.5` margin) before the key label. Primitive nodes render nothing, so keys at the same depth are horizontally misaligned — object keys appear shifted right.

**Fix:** add an invisible spacer to primitive rows:
```tsx
<span className="mr-0.5 inline-block w-3 shrink-0" aria-hidden />
```
This makes all keys at the same depth start at the same horizontal position regardless of value type.

### 5b. Filter: expand objects when label matches

**Problem:** when filtering by a key (e.g. `user`), if `user` maps to an object `{name, age}`, only the collapsed object header is shown — children are hidden because they don't individually match the query.

**Fix:** in `Node`, when the node's own label matches the filter query, skip the per-child `subtreeMatches` filter and show all entries unfiltered. The node is also forced expanded. Children of a label-matching object are never filtered out.

Logic change:
```ts
const labelMatches = !!filter && label !== undefined && label.toLowerCase().includes(filter.toLowerCase());
const entries = allEntries.filter(([k, v]) => !filter || labelMatches || subtreeMatches(k, v, filter));
const expanded = filter ? true : open;
```

### 5c. Filter: key label highlighting

When a filter is active, matching text in key labels (the `label:` spans) is highlighted using `splitHighlight` (amber `<mark>` style). Primitive values are not highlighted. Import `splitHighlight` from `features/palette/highlight.ts`.

---

## 6. Markdown description rendering (HTML-in-markdown)

**Problem:** OpenAPI descriptions often embed raw HTML (`<br/>`, `<a href="…">`) alongside markdown. `react-markdown` strips unrecognised HTML by default, so these render as plain text or disappear entirely.

**Fix:** add two rehype plugins to `Markdown.tsx`:
- `rehype-raw` — parses inline HTML nodes within the markdown AST
- `rehype-sanitize` — allowlist-based sanitization that keeps safe tags (`<br>`, `<a>`, `<strong>`, `<em>`, `<code>`, `<pre>`, `<table>`, etc.) and strips dangerous ones (`<script>`, `<style>`, `onclick`, etc.)

The existing custom `components` overrides (`a`, `code`, `ul`, etc.) still apply after parsing, so styled links and code blocks continue to work.

**New dependencies** (in `packages/web`):
- `rehype-raw`
- `rehype-sanitize`

**XSS posture:** `rehype-sanitize` with its default schema is equivalent to a strict allowlist. Specs are configured by the operator, not arbitrary end users, but sanitization ensures a malicious spec cannot inject scripts.

---

## Files affected

| File | Change |
|---|---|
| `store/store.ts` | Add `sidebarSearch`, `simpleLabels`, `setSidebarSearch`, `setSimpleLabels` |
| `store/store.types.ts` | No change needed |
| `App.tsx` | Add `ModeToggle` and Settings button to top bar; remove Export/Import/Reset from ShortcutsHelp rendering |
| `features/request/ModeToggle.tsx` | No change (reused as-is) |
| `features/request/RequestPanel.tsx` | Remove `ModeToggle` |
| `features/shortcuts/ShortcutsHelp.tsx` | Remove Export, Import, Reset sections |
| `features/operations/OperationList.tsx` | Add sidebar search input; filter sections/rows by `sidebarSearch` |
| `features/operations/OperationRow.tsx` | Simple mode row layout swap + highlight support |
| `features/palette/CommandPalette.tsx` | Simple mode label swap |
| `features/request/rjsf/theme.tsx` | Apply `humanizeLabel` to `FieldTemplate` label |
| `features/request/ParamFields.tsx` | Apply `humanizeLabel` to field name labels |
| `features/response/JsonView.tsx` | Alignment spacer; object expansion fix; key highlight |
| `lib/humanize.ts` | New utility: `humanizeLabel` |
| `features/settings/SettingsDialog.tsx` | New component: Settings modal |
| `features/common/Markdown.tsx` | Add `rehype-raw` + `rehype-sanitize` plugins |
| `packages/web/package.json` | Add `rehype-raw`, `rehype-sanitize` dependencies |

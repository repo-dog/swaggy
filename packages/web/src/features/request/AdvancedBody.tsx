import { useMemo, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import type { Operation } from "@swaggy/shared";
import type { RequestInputs } from "./buildProxyRequest.js";
import { jsonEditorTheme } from "./jsonEditorTheme.js";
import { skeletonFromSchema, sampleFromSchema } from "./initialInputs.js";
import { SchemaOutline } from "./SchemaOutline.js";
import { useStore } from "../../store/store.js";

/** A body with no meaningful content yet: unset, or an empty object/array. Simple mode's
 * form commits an empty `{}` on mount, so we treat that the same as untouched. */
function isBlankBody(body: unknown): boolean {
  if (body === undefined || body === null) return true;
  if (Array.isArray(body)) return body.length === 0;
  if (typeof body === "object") return Object.keys(body as object).length === 0;
  return false;
}

/** Advanced request-body editor: a JSON code editor with a collapsible schema reference
 * beside it. Params are rendered by RequestPanel. */
export function AdvancedBody({ op, inputs, onChange }: { op: Operation; inputs: RequestInputs; onChange: (p: Partial<RequestInputs>) => void }) {
  const theme = useStore((s) => s.theme);
  // Collapsible schema reference — default open so structure is visible; the user can fold it
  // away to give the editor the full width.
  const [schemaOpen, setSchemaOpen] = useState(true);
  // When the body is untouched (or an empty {} left by the Simple-mode form), show a full
  // schema skeleton (every field, incl. optional) as an editable template so optional fields
  // are visible. Display-only until the user edits — editing commits the JSON.
  const skeleton = useMemo(() => skeletonFromSchema(op.requestBody?.jsonSchema), [op.requestBody]);
  // The seed is the partial body initialInputsFor plants (only fields with a declared
  // default/example). A body that's blank OR still equal to that seed is untouched — show the
  // full skeleton so every optional field is visible, not just the seeded default(s). Once the
  // user edits (body diverges from the seed), show their JSON verbatim.
  const seed = useMemo(() => sampleFromSchema(op.requestBody?.jsonSchema), [op.requestBody]);
  const untouched = isBlankBody(inputs.body) || JSON.stringify(inputs.body) === JSON.stringify(seed);
  const text = untouched ? JSON.stringify(skeleton, null, 2) : JSON.stringify(inputs.body, null, 2);
  return (
    // The schema reference sits to the right of the editor. Both are pinned to 240px so their
    // heights match; the reference scrolls internally when its content overflows.
    <div className="flex items-stretch gap-2">
      {/* theme="none" hands all colors to jsonEditorTheme, which mirrors the response JsonView
          surface + token colors so request and response bodies look identical. */}
      <div className="min-w-0 flex-1 overflow-hidden rounded-md ring-1 ring-line">
        <CodeMirror
          value={text}
          theme="none"
          extensions={[json(), ...jsonEditorTheme(theme === "dark")]}
          onChange={(v) => { try { onChange({ body: v.trim() ? JSON.parse(v) : undefined }); } catch { /* keep typing; invalid JSON caught at send */ } }}
          basicSetup={{ lineNumbers: true }}
          height="240px"
        />
      </div>
      {schemaOpen ? (
        <div className="flex h-[240px] w-64 shrink-0 flex-col overflow-hidden rounded-md ring-1 ring-line">
          <div className="flex items-center justify-between border-b border-line px-2 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-content-muted">Schema</span>
            <button
              onClick={() => setSchemaOpen(false)}
              aria-label="Collapse schema reference"
              title="Collapse schema reference"
              className="text-content-faint hover:text-content-secondary"
            >
              <PanelRightClose className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-1">
            <SchemaOutline schema={op.requestBody?.jsonSchema} />
          </div>
        </div>
      ) : (
        <button
          onClick={() => setSchemaOpen(true)}
          aria-label="Expand schema reference"
          title="Show schema reference"
          className="flex h-[240px] shrink-0 flex-col items-center gap-2 rounded-md px-1.5 py-2 text-content-muted ring-1 ring-line hover:text-content-secondary"
        >
          <PanelRightOpen className="h-3.5 w-3.5" />
          <span className="text-[10px] font-semibold uppercase tracking-wide [writing-mode:vertical-rl]">Schema</span>
        </button>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type { Operation } from "@swaggy/shared";
import type { RequestInputs } from "./buildProxyRequest.js";
import { hasUnsupportedComposition } from "./degrade.js";
import { swaggyTemplates, swaggyWidgets, ShowErrorsContext } from "./rjsf/theme.js";

const bodyToText = (body: unknown) => (body === undefined ? "" : JSON.stringify(body, null, 2));

/** Raw-JSON editor used when the body schema uses unsupported composition (oneOf/anyOf/allOf).
 * Controlled + resynced when the body changes externally (Reset, snapshot, or op switch), so
 * it never shows a stale previous operation's body. */
function RawBodyEditor({ body, onChange }: { body: unknown; onChange: (p: Partial<RequestInputs>) => void }) {
  const [text, setText] = useState(() => bodyToText(body));
  const lastEmitted = useRef(text);
  const incoming = bodyToText(body);
  useEffect(() => {
    // Only resync when the body changed to something we didn't just emit (avoids clobbering
    // in-progress typing, including invalid JSON we intentionally didn't commit).
    if (incoming !== lastEmitted.current) {
      setText(incoming);
      lastEmitted.current = incoming;
    }
  }, [incoming]);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-warning">This body uses a complex schema (oneOf/anyOf/allOf) — edit as raw JSON:</span>
      <textarea
        className="min-h-40 rounded-md border border-line bg-surface p-2 font-mono text-sm text-content"
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          setText(v);
          try {
            const next = v.trim() ? JSON.parse(v) : undefined;
            lastEmitted.current = bodyToText(next);
            onChange({ body: next });
          } catch {
            /* keep typing; invalid JSON caught at send */
          }
        }}
      />
    </div>
  );
}

/** Simple (schema-driven) request-body form. Params are rendered by RequestPanel. */
export function SimpleForm({ op, inputs, onChange }: { op: Operation; inputs: RequestInputs; onChange: (p: Partial<RequestInputs>) => void }) {
  const schema = op.requestBody?.jsonSchema as any;
  // Don't *display* validation until the user has actually edited the body. Validation stays
  // live (so errors are current), but an untouched form otherwise flags optional/empty fields
  // (missing / "one of …") for values the user never entered. Flip on first input/change.
  const [touched, setTouched] = useState(false);
  // Reset the gate whenever the operation changes — RequestPanel reuses this component across
  // operations (no remount), so without this the next operation's form would show errors on
  // first view.
  useEffect(() => setTouched(false), [op.id]);

  if (!op.requestBody) return null;
  if (hasUnsupportedComposition(schema)) {
    // key by op.id so switching operations re-seeds the editor from the new body.
    return <RawBodyEditor key={op.id} body={inputs.body} onChange={onChange} />;
  }
  return (
    // Capture the first user input/change on any field to start showing errors.
    <div onInputCapture={() => setTouched(true)} onChangeCapture={() => setTouched(true)}>
      <ShowErrorsContext.Provider value={touched}>
        <Form
          schema={schema}
          validator={validator}
          formData={inputs.body}
          onChange={(e) => onChange({ body: e.formData })}
          templates={swaggyTemplates}
          widgets={swaggyWidgets}
          liveValidate
          showErrorList={false}
          uiSchema={{ "ui:submitButtonOptions": { norender: true } }}
        />
      </ShowErrorsContext.Provider>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import type { Operation } from "@swaggy/shared";
import { useStore } from "../../store/store.js";
import { useSpecs } from "../../hooks/useOperations.js";
import { initialInputsFor } from "./initialInputs.js";
import type { RequestInputs } from "./buildProxyRequest.js";
import type { HistoryEntry } from "../../store/store.types.js";
import { ServerSelect } from "./ServerSelect.js";
import { ModeToggle } from "./ModeToggle.js";
import { ParamFields } from "./ParamFields.js";
import { CustomHeaders } from "./CustomHeaders.js";
import { AdvancedBody } from "./AdvancedBody.js";
import { SimpleForm } from "./SimpleForm.js";
import { FormBody } from "./FormBody.js";
import { formMode, initialFormParts, type FormPart } from "./formModel.js";
import { SidePanels } from "./SidePanels.js";
import { snapshotDrift } from "./snapshotDrift.js";
import type { Snapshot } from "../../store/store.types.js";
import { SendBar } from "../response/SendBar.js";
import { ResponsesPanel } from "../response/ResponsesPanel.js";
import { Markdown } from "../common/Markdown.js";

export function RequestPanel({ op, replaySeed, onReplay }: { op: Operation; replaySeed?: HistoryEntry | null; onReplay?: (entry: HistoryEntry) => void }) {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const serverChoice = useStore((s) => s.serverChoiceBySpecId[op.specId]);
  const setServerChoice = useStore((s) => s.setServerChoice);
  const specServerDefs = useSpecs().data?.find((s) => s.specId === op.specId)?.serverDefs;
  // Load previously filled-in values for this operation (survives navigation + refresh),
  // falling back to schema-derived defaults. Read via getState so we don't re-render on save.
  const [inputs, setInputs] = useState<RequestInputs>(
    () => useStore.getState().inputsByOperationId[op.id] ?? initialInputsFor(op),
  );
  // Changing this remounts SendBar, clearing its transient validation/inflight state.
  const [sendNonce, setSendNonce] = useState(0);
  // Issues reported when an applied snapshot no longer matches the current API shape.
  const [snapshotIssues, setSnapshotIssues] = useState<string[]>([]);
  // Form (multipart / urlencoded) body rows. Ephemeral — files can't be persisted, so this
  // lives in component state, not the store, and re-seeds from the spec on op change / reset.
  const isFormBody = formMode(op.requestBody?.contentType) !== null;
  const [formParts, setFormParts] = useState<FormPart[]>(() => (isFormBody ? initialFormParts(op) : []));

  // Restore saved (or default) inputs whenever the operation changes.
  useEffect(() => {
    setInputs(useStore.getState().inputsByOperationId[op.id] ?? initialInputsFor(op));
    setSnapshotIssues([]);
    setFormParts(formMode(op.requestBody?.contentType) !== null ? initialFormParts(op) : []);
  }, [op.id]);

  // Apply a replay seed only when it targets the current op.
  useEffect(() => {
    if (replaySeed && replaySeed.operationId === op.id) {
      setInputs({ ...initialInputsFor(op), ...replaySeed.request });
    }
    // op.id intentionally omitted: seeding triggers on a new seed, not on op change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replaySeed]);

  // Persist edits back to the store, debounced so per-keystroke edits (e.g. the body
  // editor) stay snappy and don't rewrite localStorage on every character.
  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;
  useEffect(() => {
    const t = setTimeout(() => useStore.getState().setInputs(op.id, inputsRef.current), 400);
    return () => clearTimeout(t);
  }, [inputs, op.id]);

  const server = serverChoice ?? inputs.server;
  const patch = (p: Partial<RequestInputs>) => setInputs((prev) => ({ ...prev, ...p }));

  const reset = () => {
    // Reset clears field VALUES but preserves the ad-hoc header rows the user added (blanked),
    // so a header they rely on isn't lost on reset.
    const keptHeaders = (inputs.customHeaders ?? []).map((h) => ({ name: h.name, value: "" }));
    setInputs({ ...initialInputsFor(op), customHeaders: keptHeaders });
    useStore.getState().clearInputs(op.id);
    useStore.getState().clearResponse(op.id);
    setSnapshotIssues([]);
    setFormParts(isFormBody ? initialFormParts(op) : []);
    setSendNonce((n) => n + 1);
  };

  const applySnapshot = (snap: Snapshot) => {
    // Best-effort fill: start from current defaults so any newly-added params are
    // populated, then overlay the snapshot's saved values.
    setInputs({ ...initialInputsFor(op), ...snap.inputs });
    if (snap.inputs.server) setServerChoice(op.specId, snap.inputs.server);
    setSnapshotIssues(snapshotDrift(op, snap));
  };

  return (
    // Full-height row; each column scrolls independently so the detail view can scroll while
    // the right rail (snapshots / headers / variables / history) stays in view.
    <div className="flex h-full">
      <div id="detail-scroll" className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto py-6 pl-6 pr-6">
        <div className="flex flex-col gap-2">
          {/* Base URL sits directly above the method + path so the two read as one full
              request URL, rather than looking like an action beside Reset. */}
          <ServerSelect servers={op.servers} value={server} onChange={(v) => setServerChoice(op.specId, v)} serverDefs={specServerDefs} />
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate font-mono text-lg">
                <span className="mr-2 text-content-muted">{op.method}</span>
                <span className={op.deprecated ? "text-content-faint line-through" : undefined}>{op.path}</span>
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {op.deprecated && (
                  <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">Deprecated</span>
                )}
                {op.summary && <p className="truncate text-sm text-content-muted">{op.summary}</p>}
              </div>
              {op.externalDocs && (
                <a
                  href={op.externalDocs.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-xs text-accent underline underline-offset-2"
                >
                  <ExternalLink className="h-3 w-3" />
                  {op.externalDocs.description || "Documentation"}
                </a>
              )}
            </div>
            <button
              onClick={reset}
              className="rounded-md border border-danger bg-danger-subtle px-3 py-1 text-sm font-medium text-danger-strong hover:border-danger hover:bg-danger-subtle"
            >
              Reset
            </button>
          </header>
        </div>
        {op.description && op.description !== op.summary && (
          <Markdown className="text-sm text-content-muted">{op.description}</Markdown>
        )}
        {snapshotIssues.length > 0 && (
          <div className="rounded-md border border-warning/40 bg-warning-subtle p-3 text-sm text-warning">
            <p className="font-medium">This snapshot no longer fully matches the API:</p>
            <ul className="mt-1 list-disc pl-5">{snapshotIssues.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}
        <ParamFields op={op} inputs={inputs} onChange={patch} />
        <CustomHeaders headers={inputs.customHeaders ?? []} onChange={(customHeaders) => patch({ customHeaders })} />
        {op.requestBody && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">
                Request body
                {isFormBody && <span className="ml-2 font-mono text-[10px] normal-case text-content-faint">{op.requestBody.contentType}</span>}
              </span>
              {/* The Simple/Advanced switch only applies to a JSON body; a form body has one
                  editor. */}
              {!isFormBody && <ModeToggle mode={mode} onChange={setMode} />}
            </div>
            {isFormBody
              ? <FormBody op={op} parts={formParts} onChange={setFormParts} />
              : mode === "advanced"
                ? <AdvancedBody op={op} inputs={inputs} onChange={patch} />
                : <SimpleForm op={op} inputs={inputs} onChange={patch} />}
          </section>
        )}
        {/* Send + the live response come right after the request body; the spec's documented
            responses are reference material, so they sit below the actual result. */}
        <SendBar key={`${op.id}:${sendNonce}`} op={op} inputs={{ ...inputs, server }} formParts={isFormBody ? formParts : undefined} />
        <ResponsesPanel responses={op.responses} />
      </div>
      <SidePanels op={op} onApplySnapshot={applySnapshot} onReplay={onReplay ?? (() => {})} />
    </div>
  );
}

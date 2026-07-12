import { useEffect, useRef, useState } from "react";
import type { Operation } from "@swaggy/shared";
import { useStore } from "../../store/store.js";
import { useSpecs } from "../../hooks/useOperations.js";
import { useSendRequest } from "../../hooks/useSendRequest.js";
import { buildProxyRequest, type RequestInputs } from "../request/buildProxyRequest.js";
import { resolveAuth } from "../request/resolveAuth.js";
import { unresolvedRefsDeep } from "../request/templating.js";
import { validateInputs } from "../request/validate.js";
import { formMode, toUrlEncoded, toMultipartParts, type FormPart } from "../request/formModel.js";
import { sendProxy, sendProxyMultipart } from "../../lib/api.js";
import { SaveSnapshotButton } from "../request/SaveSnapshotButton.js";
import { toCurl } from "./copyAsCurl.js";
import { ResponseViewer } from "./ResponseViewer.js";

export function SendBar({ op, inputs, formParts }: { op: Operation; inputs: RequestInputs; formParts?: FormPart[] }) {
  const mutation = useSendRequest();
  const addHistory = useStore((s) => s.addHistory);
  const setLastResponse = useStore((s) => s.setLastResponse);
  // The last outcome for THIS operation. Scoped by op id so switching APIs never shows
  // another API's response, and returning to an API restores its last response.
  const saved = useStore((s) => s.lastResponseByOperationId[op.id]);
  const activeProfile = useStore((s) => s.profiles.find((p) => p.profileId === s.activeProfileId));
  const setVariable = useStore((s) => s.setVariable);
  const [errors, setErrors] = useState<string[]>([]);

  const commonHeaders = activeProfile?.commonHeaders ?? [];
  const variables = activeProfile?.variables ?? {};
  // Resolve the profile's security credentials for this op into headers/query at send time
  // (kept out of stored history, like common headers). Schemes come from the spec metadata.
  const schemes = useSpecs().data?.find((s) => s.specId === op.specId)?.securitySchemes;
  const auth = resolveAuth(op, schemes, activeProfile?.authValues);

  // Body transport: JSON (default) rides the JSON proxy; a form body is either serialized to a
  // urlencoded string (also the JSON proxy) or sent as a real multipart request.
  const mode = formParts ? formMode(op.requestBody?.contentType) : null;
  const effectiveInputs =
    mode === "urlencoded"
      ? { ...inputs, body: toUrlEncoded(formParts!, variables), headers: { ...inputs.headers, "content-type": "application/x-www-form-urlencoded" } }
      : inputs;
  const req = buildProxyRequest(op, effectiveInputs, commonHeaders, variables, auth);
  const sendTask = () => {
    if (mode === "multipart") {
      const { body: _omitBody, ...meta } = req;
      return sendProxyMultipart(meta, toMultipartParts(formParts!, variables));
    }
    return sendProxy(req);
  };

  // {{name}} references with no matching variable — surfaced as a non-blocking warning;
  // they're sent literally, which is usually the sign of a typo or a not-yet-captured value.
  const unresolved = unresolvedRefsDeep(
    [inputs.server, inputs.pathParams, inputs.query, inputs.headers, inputs.body, commonHeaders.map((h) => h.value), (inputs.customHeaders ?? []).map((h) => h.value), (formParts ?? []).map((p) => p.value)],
    variables,
  );

  const onSend = async () => {
    const errs = validateInputs(op, inputs);
    setErrors(errs);
    if (errs.length > 0) return;
    try {
      const result = await mutation.mutateAsync(sendTask);
      setLastResponse(op.id, { kind: "result", result });
      if (result.ok) {
        // History body: urlencoded rides as its serialized string; multipart records a
        // file-free summary (bytes aren't persisted), else the JSON body.
        const historyBody =
          mode === "multipart"
            ? { __form: toMultipartParts(formParts!, variables).map((p) => (p.files ? { name: p.name, files: p.files.map((f) => f.name) } : { name: p.name, value: p.value })) }
            : effectiveInputs.body;
        addHistory({
          operationId: op.id, durationMs: result.response.durationMs,
          // Store only user-entered headers (not auth-merged headers) to keep secrets out of history.
          // Auth is re-merged from the active profile at send/replay time via buildProxyRequest.
          request: { server: inputs.server, pathParams: inputs.pathParams, query: inputs.query, headers: inputs.headers, customHeaders: inputs.customHeaders, body: historyBody },
          response: { status: result.response.status, headers: result.response.headers, body: result.response.body, bodyTruncated: false },
        });
      }
    } catch (err) {
      // Network-level throw (not a proxy {ok:false} response). Persist a marker so the
      // failure is remembered per operation like any other outcome.
      setLastResponse(op.id, { kind: "network_error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  // Keyboard: mod+Enter sends; mod+Shift+C copies the response as cURL. Subscribe once
  // (mount → unmount) and read the latest handlers/request through a ref, rather than
  // re-adding the listener on every render.
  const latest = useRef({ onSend, req, saved });
  latest.current = { onSend, req, saved };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const { onSend, req, saved } = latest.current;
      if (e.key === "Enter") {
        e.preventDefault();
        void onSend();
      } else if (e.shiftKey && e.key.toLowerCase() === "c" && saved?.kind === "result" && saved.result.ok) {
        e.preventDefault();
        navigator.clipboard?.writeText(toCurl(req));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={onSend}
          disabled={op.servers.length === 0 || mutation.isPending}
          className="rounded-md bg-accent px-5 py-2 text-sm font-semibold text-accent-contrast shadow-sm hover:bg-accent-strong disabled:opacity-40"
        >
          {mutation.isPending ? "Sending…" : "Send"}
        </button>
        {/* Offer to snapshot the request only once one has actually been sent. */}
        {saved && <SaveSnapshotButton op={op} inputs={inputs} />}
      </div>
      {unresolved.length > 0 && (
        <p className="rounded-md border border-warning/40 bg-warning-subtle p-3 text-sm text-warning">
          Unresolved {unresolved.length === 1 ? "variable" : "variables"}: {unresolved.map((n) => `{{${n}}}`).join(", ")} — define {unresolved.length === 1 ? "it" : "them"} in Variables, or {unresolved.length === 1 ? "it is" : "they are"} sent as-is.
        </p>
      )}
      {errors.length > 0 && (
        <ul className="rounded-md bg-danger-subtle p-3 text-sm text-danger-strong">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
      {saved?.kind === "network_error" && (
        <p className="rounded-md bg-danger-subtle p-3 text-sm text-danger-strong">Network error: {saved.message}</p>
      )}
      {saved?.kind === "result" && <ResponseViewer result={saved.result} curl={toCurl(req)} onCaptureVariable={setVariable} existingVariableNames={Object.keys(variables)} />}
    </div>
  );
}

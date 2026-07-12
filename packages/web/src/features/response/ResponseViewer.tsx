import { useState } from "react";
import { Download } from "lucide-react";
import type { ProxyResponse, ProxyError } from "@swaggy/shared";
import { cn } from "../../lib/cn.js";
import { JsonView } from "./JsonView.js";

type Result = { ok: true; response: ProxyResponse } | { ok: false; error: ProxyError };

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** Case-insensitive header lookup (upstream header casing varies). */
function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() === lower) return v;
  return undefined;
}

function extensionFor(contentType: string | undefined): string {
  if (!contentType) return "txt";
  if (contentType.includes("json")) return "json";
  if (contentType.includes("xml")) return "xml";
  if (contentType.includes("html")) return "html";
  if (contentType.includes("csv")) return "csv";
  return "txt";
}

function Stat({ label, value, valueClass, title }: { label: string; value: string; valueClass?: string; title?: string }) {
  return (
    <div className="flex min-w-0 flex-col rounded-md border border-line bg-surface px-3 py-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-content-faint">{label}</span>
      <span title={title} className={cn("font-mono text-sm font-semibold text-content", valueClass)}>{value}</span>
    </div>
  );
}

type CaptureFn = (value: unknown, suggestedName?: string) => void;

/** The body rendered as an interactive JSON tree when it's an object/array, else raw text.
 * A genuinely empty body (no content, e.g. a 204) shows a hint rather than a blank box. */
function Body({ body, bodyText, onCapture }: { body: unknown; bodyText: string; onCapture?: CaptureFn }) {
  const isEmpty = body === null || body === undefined || (typeof body === "string" && body.trim() === "");
  if (isEmpty) {
    return <p className="rounded-md border border-dashed border-line bg-surface-muted p-3 text-xs italic text-content-faint">No response body.</p>;
  }
  const isJson = typeof body === "object";
  if (isJson) return <JsonView data={body} onCapture={onCapture} />;
  return <pre className="overflow-auto rounded-md bg-surface-code p-3 text-xs text-content-inverse">{bodyText}</pre>;
}

/** How a captured JSON value is stored: strings verbatim, everything else as compact JSON. */
function stringifyForVariable(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function ResponseViewer({
  result,
  curl,
  onCaptureVariable,
  existingVariableNames = [],
}: {
  result: Result;
  curl: string;
  onCaptureVariable?: (name: string, value: string) => void;
  existingVariableNames?: string[];
}) {
  const [pendingCapture, setPendingCapture] = useState<{ value: string; name: string } | null>(null);
  const copy = (text: string) => navigator.clipboard?.writeText(text);

  const onCapture: CaptureFn | undefined = onCaptureVariable
    ? (value, suggestedName) => setPendingCapture({ value: stringifyForVariable(value), name: suggestedName ?? "" })
    : undefined;
  const saveCapture = () => {
    if (pendingCapture && pendingCapture.name.trim()) {
      onCaptureVariable?.(pendingCapture.name.trim(), pendingCapture.value);
      setPendingCapture(null);
    }
  };

  if (!result.ok) {
    return <div className="rounded-md bg-danger-subtle p-3 text-sm text-danger-strong">Request failed ({result.error.error.kind}): {result.error.error.message}</div>;
  }
  const r = result.response;
  const bodyText = typeof r.body === "string" ? r.body : JSON.stringify(r.body, null, 2);
  const ok = r.status >= 200 && r.status < 300;
  const contentType = headerValue(r.headers, "content-type");
  const location = headerValue(r.headers, "location");
  const isRedirect = r.status >= 300 && r.status < 400;

  const download = () => {
    const blob = new Blob([bodyText], { type: contentType || "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `response-${r.status}.${extensionFor(contentType)}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Stat
          label="Status"
          value={`${r.status}${r.statusText ? ` ${r.statusText}` : ""}`}
          valueClass={ok ? "text-success" : "text-danger"}
        />
        <Stat label="Time" value={formatMs(r.durationMs)} />
        <Stat label="Size" value={formatBytes(r.bodySize)} />
        {contentType && (
          <Stat label="Type" value={contentType.split(";")[0]} title={contentType} valueClass="max-w-[12rem] truncate" />
        )}
        <div className="ml-auto flex items-center gap-2 text-sm">
          <button
            className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-content-secondary hover:bg-surface-muted hover:text-content dark:hover:text-content"
            onClick={download}
            aria-label="Download response body"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </button>
          <button className="rounded-md border border-line px-2 py-1 text-content-secondary hover:bg-surface-muted hover:text-content dark:hover:text-content" onClick={() => copy(bodyText)}>Copy body</button>
          <button className="rounded-md border border-line px-2 py-1 text-content-secondary hover:bg-surface-muted hover:text-content dark:hover:text-content" onClick={() => copy(curl)}>Copy as cURL</button>
        </div>
      </div>
      {location && (
        <div className="rounded-md border border-accent/30 bg-accent-subtle px-3 py-2 text-sm text-accent">
          <span className="font-medium">Location:</span> <span className="break-all font-mono">{location}</span>
          {isRedirect && <span className="ml-1 text-xs text-accent">— redirect target (not auto-followed)</span>}
        </div>
      )}
      {pendingCapture && (() => {
        const nameTrimmed = pendingCapture.name.trim();
        // Saving over an existing variable is a deliberate act: require an explicit "Replace"
        // rather than silently overwriting whatever was captured before.
        const collision = nameTrimmed !== "" && existingVariableNames.includes(nameTrimmed);
        return (
          <div className={cn("flex flex-col gap-1.5 rounded-md border px-3 py-2 text-sm", collision ? "border-warning/50 bg-warning-subtle" : "border-success/30 bg-success/10")}>
            <div className="flex items-center gap-2">
              <span className={cn("shrink-0", collision ? "text-warning" : "text-success")}>Save as variable</span>
              <input
                autoFocus
                aria-label="Variable name"
                value={pendingCapture.name}
                onChange={(e) => setPendingCapture((c) => (c ? { ...c, name: e.target.value } : c))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveCapture();
                  else if (e.key === "Escape") setPendingCapture(null);
                }}
                placeholder="name"
                className={cn("w-40 shrink-0 rounded-md border bg-surface px-2 py-1 font-mono text-xs text-content outline-none", collision ? "border-warning/60" : "border-success/50")}
              />
              {/* Save/Replace stay next to the input; the value preview fills the leftover space. */}
              <button
                onClick={saveCapture}
                disabled={nameTrimmed === ""}
                className={cn("shrink-0 rounded px-2 py-1 text-xs text-white disabled:opacity-40", collision ? "bg-warning" : "bg-success")}
              >
                {collision ? "Replace" : "Save"}
              </button>
              <button onClick={() => setPendingCapture(null)} className="shrink-0 text-xs text-content-muted hover:text-content-secondary">Cancel</button>
              <span className="min-w-0 flex-1 truncate text-right font-mono text-xs text-content-muted" title={pendingCapture.value}>
                = {pendingCapture.value}
              </span>
            </div>
            {collision && (
              <p className="text-xs text-warning">
                A variable named <span className="font-mono font-medium">{nameTrimmed}</span> already exists — choose a new name, or Replace to overwrite it.
              </p>
            )}
          </div>
        );
      })()}
      {/* No fixed height / inner vertical scroll: the body flows and the detail column is the
          single scroller, so it uses the space it needs without a nested scrollbox that runs
          off-screen. Keep horizontal scroll for wide, unbreakable lines. Expand gives a
          full-screen view for very large payloads. */}
      <div className="overflow-x-auto">
        <Body body={r.body} bodyText={bodyText} onCapture={onCapture} />
      </div>
      {Object.keys(r.headers).length > 0 && (
        <details className="text-xs text-content-muted">
          <summary className="cursor-pointer">Response headers</summary>
          <pre className="mt-1">{Object.entries(r.headers).map(([k, v]) => `${k}: ${v}`).join("\n")}</pre>
        </details>
      )}
    </div>
  );
}

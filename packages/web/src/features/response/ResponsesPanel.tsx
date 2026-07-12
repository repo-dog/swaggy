import type { ResponseDef } from "@swaggy/shared";
import { SchemaOutline } from "../request/SchemaOutline.js";
import { Markdown } from "../common/Markdown.js";

/** Tailwind text color for a response status, by class (2xx success … 5xx danger). */
function statusColor(status: string): string {
  switch (status[0]) {
    case "2": return "text-success";
    case "3": return "text-accent";
    case "4": return "text-warning";
    case "5": return "text-danger";
    default: return "text-content-muted";
  }
}

function ResponseRow({ r }: { r: ResponseDef }) {
  const hasDetail = r.jsonSchema != null || r.example !== undefined;
  const header = (
    <>
      <span className={`font-mono text-xs font-semibold ${statusColor(r.status)}`}>{r.status}</span>
      {r.contentType && <span className="font-mono text-[11px] text-content-faint">{r.contentType}</span>}
      {r.description && <Markdown className="text-[11px] text-content-muted">{r.description}</Markdown>}
    </>
  );
  if (!hasDetail) return <div className="flex flex-wrap items-center gap-2 px-1 py-1">{header}</div>;
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 rounded px-1 py-1 hover:bg-surface-muted">
        {header}
      </summary>
      <div className="mt-1 flex flex-col gap-2 border-l border-line pl-2">
        {r.jsonSchema != null && <SchemaOutline schema={r.jsonSchema} />}
        {r.example !== undefined && (
          <pre className="overflow-auto rounded bg-surface-code p-2 font-mono text-[11px] text-content-inverse">
            {typeof r.example === "string" ? r.example : JSON.stringify(r.example, null, 2)}
          </pre>
        )}
      </div>
    </details>
  );
}

/** Documented responses declared by the spec (status codes, schemas, examples), shown for
 * reference. Collapsed by default so it doesn't push the Send action down; independent of the
 * actual proxied response (which the ResponseViewer shows after sending). */
export function ResponsesPanel({ responses }: { responses: ResponseDef[] }) {
  if (!responses || responses.length === 0) return null;
  return (
    <details className="rounded-md border border-line">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-content-muted hover:bg-surface-muted">
        Responses ({responses.length})
      </summary>
      <div className="flex flex-col gap-1 border-t border-line p-2">
        {responses.map((r) => <ResponseRow key={`${r.status}:${r.contentType ?? ""}`} r={r} />)}
      </div>
    </details>
  );
}

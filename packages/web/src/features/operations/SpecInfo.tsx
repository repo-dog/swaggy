import { useState } from "react";
import { Info, ExternalLink } from "lucide-react";
import type { SpecMeta } from "@swaggy/shared";
import { useSpecs } from "../../hooks/useOperations.js";
import { SpecStatusBadge } from "./SpecStatusBadge.js";
import { Markdown } from "../common/Markdown.js";

/** The spec's info block (title, version, status, description, contact, license, docs). Pure
 * so it can be rendered/tested without the data-fetching wrapper. */
export function SpecInfoCard({ meta }: { meta: SpecMeta }) {
  const contact = meta.contact;
  const contactLine = [contact?.name, contact?.email && `<${contact.email}>`].filter(Boolean).join(" ");
  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-content">{meta.title}</span>
        <span className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-content-secondary">v{meta.version}</span>
      </div>
      <div className="mt-1"><SpecStatusBadge status={meta.status} /></div>
      {meta.description && <Markdown className="mt-2 text-xs text-content-muted">{meta.description}</Markdown>}
      {contactLine && <p className="mt-2 text-xs text-content-muted">Contact: {contactLine}</p>}
      {meta.license?.name && (
        <p className="mt-1 text-xs text-content-muted">
          License:{" "}
          {meta.license.url ? (
            <a className="text-accent underline" href={meta.license.url} target="_blank" rel="noreferrer">{meta.license.name}</a>
          ) : (
            meta.license.name
          )}
        </p>
      )}
      {meta.externalDocs && (
        <a className="mt-2 inline-flex items-center gap-1 text-xs text-accent underline underline-offset-2" href={meta.externalDocs.url} target="_blank" rel="noreferrer">
          <ExternalLink className="h-3 w-3" />
          {meta.externalDocs.description || "Documentation"}
        </a>
      )}
      {meta.serverUrls[0] && (
        <p className="mt-2 truncate font-mono text-[11px] text-content-faint" title={meta.serverUrls[0]}>{meta.serverUrls[0]}</p>
      )}
    </div>
  );
}

/** An info button + popover showing the active spec's info block. */
export function SpecInfo({ specId }: { specId: string | null }) {
  const { data: specs = [] } = useSpecs();
  const [open, setOpen] = useState(false);
  const meta = specs.find((s) => s.specId === specId);
  if (!meta) return null;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Spec info"
        title="Spec info"
        aria-expanded={open}
        className="rounded-md border border-line px-1.5 py-1 text-content-secondary hover:bg-surface-muted hover:text-content"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <button aria-hidden tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-10 cursor-default" />
          <div className="absolute left-0 z-20 mt-1 w-72 rounded-md border border-line bg-surface p-3 shadow-lg">
            <SpecInfoCard meta={meta} />
          </div>
        </>
      )}
    </div>
  );
}

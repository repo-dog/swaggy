import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/cn.js";

// Compact renderers tuned for OpenAPI descriptions (short, inline-heavy). react-markdown does
// NOT render raw HTML unless rehype-raw is added, so this is safe against HTML injection.
const components: Components = {
  a: (p) => <a {...p} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2" />,
  code: (p) => <code {...p} className="rounded bg-surface-muted px-1 py-0.5 font-mono text-[0.85em]" />,
  ul: (p) => <ul {...p} className="list-disc space-y-0.5 pl-4" />,
  ol: (p) => <ol {...p} className="list-decimal space-y-0.5 pl-4" />,
  // Headings inside a field description would be oversized; render them as bold text.
  h1: (p) => <p {...p} className="font-semibold text-content" />,
  h2: (p) => <p {...p} className="font-semibold text-content" />,
  h3: (p) => <p {...p} className="font-semibold text-content" />,
  h4: (p) => <p {...p} className="font-semibold text-content" />,
  table: (p) => <table {...p} className="my-1 border-collapse" />,
  th: (p) => <th {...p} className="border border-line px-1.5 py-0.5 text-left" />,
  td: (p) => <td {...p} className="border border-line px-1.5 py-0.5" />,
  pre: (p) => <pre {...p} className="overflow-auto rounded bg-surface-muted p-2" />,
};

/** Render a markdown string (CommonMark + GFM) as safe, compactly-styled React nodes.
 * Renders nothing for empty/absent input. Use for spec description fields. */
export function Markdown({ children, className }: { children?: string | null; className?: string }) {
  if (!children || !children.trim()) return null;
  return (
    <div className={cn("space-y-1 leading-snug [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

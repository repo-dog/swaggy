import type { SpecStatus } from "@swaggy/shared";

const COLOR: Record<SpecStatus, string> = {
  ok: "bg-success",
  stale: "bg-warning",
  error: "bg-danger",
};

export function SpecStatusBadge({ status }: { status: SpecStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-content-muted">
      <span className={`h-2 w-2 rounded-full ${COLOR[status]}`} /> {status}
    </span>
  );
}

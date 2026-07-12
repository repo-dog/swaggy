import { Star } from "lucide-react";
import { useStore } from "../../store/store.js";
import { cn } from "../../lib/cn.js";

export function BookmarkButton({ operationId, className }: { operationId: string; className?: string }) {
  const isBookmarked = useStore(
    (s) =>
      s.profiles
        .find((p) => p.profileId === s.activeProfileId)
        ?.operationIds.includes(operationId) ?? false,
  );
  const toggle = useStore((s) => s.toggleBookmark);
  return (
    <button
      onClick={() => toggle(operationId)}
      // Bookmark gold (amber) is an intentional, decorative accent — not part of the neutral theme.
      className={cn("text-content-faint hover:text-amber-500 dark:hover:text-amber-400", className)}
      aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
      aria-pressed={isBookmarked}
    >
      <Star className={cn("h-4 w-4", isBookmarked && "fill-amber-400 text-amber-500")} />
    </button>
  );
}

import { type ReactElement } from "react";
import { cn } from "../../lib/cn";

export function SmartAlbumPlaceItemCard({
  title,
  mediaCount,
  onClick,
  className,
}: {
  title: string;
  mediaCount: number;
  onClick: () => void;
  className?: string;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border border-border bg-card px-3 py-2 text-left hover:bg-muted",
        className,
      )}
    >
      <div className="font-semibold text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground">{mediaCount} items</div>
    </button>
  );
}

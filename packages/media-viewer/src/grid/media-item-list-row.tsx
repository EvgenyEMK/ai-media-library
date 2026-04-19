"use client";

import { useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { MediaItemStarRating } from "./media-item-star-rating";

export interface MediaItemListRowProps {
  title: string;
  onClick: () => void;
  /** Thumbnail region (e.g. Next/Image wrapper or plain `<img />`). */
  thumbnail: ReactNode;
  /** Secondary line (e.g. photo date). */
  metadataLine?: string;
  /** Optional folder / path line (e.g. search results). */
  folderLine?: string;
  /** Extra detail lines (e.g. AI search similarity scores). */
  extraLines?: string[];
  starRating?: number | null;
  onStarRatingChange?: (next: number) => void;
  starRatingShowRejected?: boolean;
  actions?: ReactNode;
  /**
   * Keeps the actions slot visible when a child menu is open in a portal (e.g. Radix dropdown),
   * so the trigger does not disappear when the pointer leaves the row.
   */
  forceShowActions?: boolean;
}

const styles: Record<string, CSSProperties> = {
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "hsl(var(--border))",
    cursor: "pointer",
    transition: "background-color 160ms ease",
    backgroundColor: "transparent",
  },
  rowHover: {
    backgroundColor: "hsl(var(--muted) / 0.45)",
  },
  body: {
    flex: 1,
    minWidth: 0,
    padding: 8,
    display: "grid",
    gap: 4,
  },
  title: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: "hsl(var(--foreground))",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  meta: {
    margin: 0,
    fontSize: 14,
    color: "hsl(var(--muted-foreground))",
    textTransform: "capitalize",
  },
  folder: {
    margin: 0,
    fontSize: 12,
    color: "hsl(var(--muted-foreground))",
    opacity: 0.92,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  actions: {
    flexShrink: 0,
    paddingRight: 8,
    display: "flex",
    alignItems: "center",
  },
};

export function MediaItemListRow({
  title,
  onClick,
  thumbnail,
  metadataLine,
  folderLine,
  extraLines,
  starRating,
  onStarRatingChange,
  starRatingShowRejected = false,
  actions,
  forceShowActions = false,
}: MediaItemListRowProps): ReactElement {
  const rowRef = useRef<HTMLElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [ratingFocused, setRatingFocused] = useState(false);
  const showActions = isHovered || forceShowActions;
  const ratingExpanded = Boolean(onStarRatingChange) && (isHovered || ratingFocused);

  const collapseRatingChrome = (): void => {
    setRatingFocused(false);
    const root = rowRef.current;
    const ae = document.activeElement;
    if (root && ae instanceof HTMLElement && root.contains(ae)) {
      ae.blur();
    }
  };

  return (
    <article
      ref={rowRef}
      style={styles.row}
      onClick={onClick}
      onMouseEnter={(e) => {
        setIsHovered(true);
        Object.assign(e.currentTarget.style, styles.rowHover);
      }}
      onMouseLeave={(e) => {
        setIsHovered(false);
        e.currentTarget.style.backgroundColor = styles.row.backgroundColor as string;
        collapseRatingChrome();
      }}
    >
      {thumbnail}
      <div style={styles.body}>
        {starRating !== undefined || onStarRatingChange ? (
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onFocusCapture={() => setRatingFocused(true)}
            onBlurCapture={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setRatingFocused(false);
              }
            }}
          >
            <MediaItemStarRating
              starRating={starRating ?? null}
              onChange={onStarRatingChange}
              showRejectedIndicator={starRatingShowRejected}
              expanded={ratingExpanded}
              tone="onCard"
            />
          </div>
        ) : null}
        <h3 style={styles.title}>{title}</h3>
        {metadataLine ? <p style={styles.meta}>{metadataLine}</p> : null}
        {folderLine ? <p style={styles.folder}>{folderLine}</p> : null}
        {extraLines?.map((line, index) => (
          <p key={index} style={styles.folder}>
            {line}
          </p>
        ))}
      </div>
      {actions ? (
        <div
          style={{
            ...styles.actions,
            opacity: showActions ? 1 : 0,
            transition: "opacity 160ms ease",
            pointerEvents: showActions ? "auto" : "none",
          }}
        >
          {actions}
        </div>
      ) : null}
    </article>
  );
}

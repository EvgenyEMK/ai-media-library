"use client";

import { useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { MediaItemStarRating } from "./media-item-star-rating";

interface MediaItemGridCardProps {
  title: string;
  imageUrl?: string | null;
  subtitle?: string;
  onClick: () => void;
  priority?: boolean;
  actions?: ReactNode;
  starRating?: number | null;
  onStarRatingChange?: (next: number) => void;
  /** When true, surface a distinct rejected (-1) badge; desktop defaults off until pick/reject UX ships. */
  starRatingShowRejected?: boolean;
}

const styles: Record<string, CSSProperties> = {
  card: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
    borderRadius: 8,
    cursor: "pointer",
  },
  imageWrap: {
    position: "relative",
    width: "100%",
    height: 256,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    transition: "transform 220ms ease",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    fontSize: 13,
    background: "#1e293b",
  },
  actions: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 20,
  },
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "flex-end",
    padding: 16,
    transition: "background-color 180ms ease",
  },
  caption: {
    color: "#f8fafc",
    display: "grid",
    gap: 4,
    textShadow: "0 2px 6px rgba(2, 6, 23, 0.8)",
  },
  title: {
    fontWeight: 600,
    fontSize: 14,
  },
  subtitle: {
    fontSize: 12,
    opacity: 0.9,
  },
};

export function MediaItemGridCard({
  title,
  imageUrl,
  subtitle,
  onClick,
  priority = false,
  actions,
  starRating,
  onStarRatingChange,
  starRatingShowRejected = false,
}: MediaItemGridCardProps): ReactElement {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [ratingFocused, setRatingFocused] = useState(false);
  const ratingExpanded = Boolean(onStarRatingChange) && (isHovered || ratingFocused);

  const collapseRatingChrome = (): void => {
    setRatingFocused(false);
    const root = cardRef.current;
    const ae = document.activeElement;
    if (root && ae instanceof HTMLElement && root.contains(ae)) {
      ae.blur();
    }
  };

  return (
    <div
      ref={cardRef}
      style={styles.card}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        collapseRatingChrome();
      }}
    >
      <div style={styles.imageWrap}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            style={{
              ...styles.image,
              ...(isHovered ? { transform: "scale(1.1)" } : {}),
            }}
          />
        ) : (
          <div style={styles.placeholder}>Preview unavailable</div>
        )}
        {starRating !== undefined || onStarRatingChange ? (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              zIndex: 15,
              maxWidth: "calc(100% - 16px)",
            }}
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
              tone="onPhoto"
            />
          </div>
        ) : null}
      </div>
      {actions ? (
        <div
          style={{
            ...styles.actions,
            opacity: isHovered ? 1 : 0,
            transition: "opacity 180ms ease",
            pointerEvents: isHovered ? "auto" : "none",
          }}
        >
          {actions}
        </div>
      ) : null}
      <div
        style={{
          ...styles.overlay,
          backgroundColor: isHovered ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0)",
        }}
      >
        <div
          style={{
            ...styles.caption,
            opacity: isHovered ? 1 : 0,
            transition: "opacity 180ms ease",
          }}
        >
          <div style={styles.title}>{title}</div>
          {subtitle ? <div style={styles.subtitle}>{subtitle}</div> : null}
        </div>
      </div>
    </div>
  );
}

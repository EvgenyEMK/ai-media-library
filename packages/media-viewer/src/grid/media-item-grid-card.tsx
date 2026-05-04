"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { MediaItemStarRating } from "./media-item-star-rating";
import { cleanupReorderDragPreview, installReorderDragPreview } from "./reorder-drag-preview";

export interface MediaItemGridCardDragReorder {
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}

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
  mediaType?: "image" | "video";
  /**
   * When set, the card is draggable for reorder except when the drag originates from the star
   * control or the actions menu region.
   */
  dragReorder?: MediaItemGridCardDragReorder;
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
  mediaBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    zIndex: 12,
    width: 24,
    height: 24,
    borderRadius: 999,
    background: "rgba(15, 23, 42, 0.82)",
    border: "1px solid rgba(148, 163, 184, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#f8fafc",
    boxShadow: "0 2px 6px rgba(2, 6, 23, 0.45)",
  },
};

function isTargetInside(root: HTMLElement | null, target: EventTarget | null): boolean {
  if (!root || !target || !(target instanceof Node)) {
    return false;
  }
  return root.contains(target);
}

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
  mediaType = "image",
  dragReorder,
}: MediaItemGridCardProps): ReactElement {
  const cardRef = useRef<HTMLDivElement>(null);
  const reorderDragGhostRef = useRef<HTMLDivElement | null>(null);
  const starsChromeRef = useRef<HTMLDivElement>(null);
  const actionsChromeRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [ratingFocused, setRatingFocused] = useState(false);
  const [videoVisible, setVideoVisible] = useState(priority);
  const ratingExpanded = Boolean(onStarRatingChange) && (isHovered || ratingFocused);

  useEffect(() => {
    if (mediaType !== "video" || priority) {
      setVideoVisible(true);
      return;
    }
    const root = cardRef.current;
    if (!root) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVideoVisible(true);
          observer.disconnect();
        }
      },
      { root: null, rootMargin: "240px 0px" },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [mediaType, priority]);

  useEffect(() => {
    return () => {
      cleanupReorderDragPreview(reorderDragGhostRef);
    };
  }, []);

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
      draggable={Boolean(dragReorder)}
      style={{
        ...styles.card,
        ...(dragReorder ? { cursor: "grab" } : {}),
      }}
      onClick={onClick}
      onDragStart={(event) => {
        if (!dragReorder) {
          return;
        }
        if (
          isTargetInside(starsChromeRef.current, event.target) ||
          isTargetInside(actionsChromeRef.current, event.target)
        ) {
          event.preventDefault();
          return;
        }
        const card = cardRef.current;
        if (card) {
          installReorderDragPreview(event, card, reorderDragGhostRef, {
            imageUrl,
            mediaType: mediaType ?? "image",
          });
        }
        dragReorder.onDragStart(event);
      }}
      onDragEnd={() => {
        cleanupReorderDragPreview(reorderDragGhostRef);
        dragReorder?.onDragEnd();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        collapseRatingChrome();
      }}
    >
      <div style={styles.imageWrap}>
        {imageUrl ? (
          mediaType === "video" ? (
            videoVisible ? (
              <video
                src={imageUrl}
                muted
                preload="metadata"
                playsInline
                draggable={dragReorder ? false : undefined}
                onClick={onClick}
                style={{
                  ...styles.image,
                  ...(dragReorder ? { WebkitUserDrag: "none" as const } : {}),
                  ...(isHovered ? { transform: "scale(1.1)" } : {}),
                }}
              />
            ) : (
              <div
                style={{
                  ...styles.image,
                  background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#e2e8f0",
                  fontSize: 14,
                }}
                onClick={onClick}
              >
                Video
              </div>
            )
          ) : (
            <img
              src={imageUrl}
              alt={title}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              draggable={dragReorder ? false : undefined}
              onClick={onClick}
              style={{
                ...styles.image,
                ...(dragReorder ? { WebkitUserDrag: "none" as const } : {}),
                ...(isHovered ? { transform: "scale(1.1)" } : {}),
              }}
            />
          )
        ) : (
          <div style={styles.placeholder}>Preview unavailable</div>
        )}
        {mediaType === "video" ? (
          <div style={styles.mediaBadge} aria-label="Video item" title="Video">
            <svg width="13" height="13" viewBox="0 0 10 10" aria-hidden="true">
              <path d="M2 1.5L8 5L2 8.5V1.5Z" fill="currentColor" />
            </svg>
          </div>
        ) : null}
        {starRating !== undefined || onStarRatingChange ? (
          <div
            ref={starsChromeRef}
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
          ref={actionsChromeRef}
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

"use client";

import {
  useCallback,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactElement,
} from "react";

export type MediaItemStarRatingTone = "onPhoto" | "onCard";

export interface MediaItemStarRatingProps {
  starRating: number | null | undefined;
  onChange?: (next: number) => void;
  /**
   * When true, show a distinct rejected (-1) affordance. Desktop keeps this off until
   * pick/reject flows are exposed; callers control visibility.
   */
  showRejectedIndicator?: boolean;
  /** Full editor (clear + 5 stars). Parent drives from hover / focus / policy. */
  expanded?: boolean;
  tone?: MediaItemStarRatingTone;
}

const GOLD_FULL = "#fbbf24";
const GOLD_DIM = "rgba(251, 191, 36, 0.5)";

const rowStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const badgeOnPhotoStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1,
  padding: "3px 7px",
  borderRadius: 6,
  backgroundColor: "rgba(2, 6, 23, 0.72)",
  backdropFilter: "blur(6px)",
};

const badgeOnCardStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1,
  padding: "3px 7px",
  borderRadius: 6,
  backgroundColor: "hsl(var(--muted) / 0.45)",
  border: "1px solid hsl(var(--border) / 0.6)",
};

function starEmptyStroke(tone: MediaItemStarRatingTone): string {
  if (tone === "onPhoto") {
    return "rgba(248, 250, 252, 0.45)";
  }
  return "hsl(var(--muted-foreground) / 0.55)";
}

function IconStar(props: {
  variant: "empty" | "dim" | "full" | "outline";
  emptyStroke: string;
  size: number;
}): ReactElement {
  const { variant, emptyStroke, size } = props;
  const fill =
    variant === "empty" || variant === "outline"
      ? "none"
      : variant === "dim"
        ? GOLD_DIM
        : GOLD_FULL;
  const stroke =
    variant === "empty"
      ? emptyStroke
      : variant === "outline" || variant === "full"
        ? GOLD_FULL
        : GOLD_DIM;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill={fill}
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
        d="M12 3.5l2.47 5.01 5.53.8-4 3.9.94 5.5L12 16.9l-4.94 2.6.94-5.5-4-3.9 5.53-.8L12 3.5z"
      />
    </svg>
  );
}

/** “Rejected / pick” (-1): distinct from unrated; shown only when `showRejectedIndicator` is true. */
function IconRejected(props: { size: number; color: string }): ReactElement {
  const s = props.size;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke={props.color} strokeWidth="1.75" />
      <path
        fill="none"
        stroke={props.color}
        strokeWidth="1.75"
        strokeLinecap="round"
        d="M8 8l8 8M16 8l-8 8"
      />
    </svg>
  );
}

function IconUnset(props: { size: number; stroke: string }): ReactElement {
  return (
    <svg
      width={props.size}
      height={props.size}
      viewBox="0 0 24 24"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="none"
        stroke={props.stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M6 6l12 12M18 6L6 18"
      />
    </svg>
  );
}

function normalizedCount(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 0;
  }
  const n = Math.round(value);
  if (n < 0) {
    return 0;
  }
  return Math.min(5, Math.max(0, n));
}

/** Per-star state while interacting: dim = “would add” or “would remove” before click. */
/** Downgrade hover: stars that would clear use gold outline only (not dim fill) for a clearer cue. */
function starPreviewState(
  i: number,
  c: number,
  h: number | null,
): "empty" | "dim" | "full" | "outline" {
  if (h === null) {
    return i <= c ? "full" : "empty";
  }
  if (h > c) {
    if (i <= c) {
      return "full";
    }
    if (i <= h) {
      return "dim";
    }
    return "empty";
  }
  if (h < c) {
    if (i <= h) {
      return "full";
    }
    if (i <= c) {
      return "outline";
    }
    return "empty";
  }
  return i <= c ? "full" : "empty";
}

/** True when a positive star count should show the compact badge (1–5 only). */
export function shouldShowStarCompactBadge(starRating: number | null | undefined): boolean {
  const n = starRating;
  if (n === null || n === undefined || !Number.isFinite(n)) {
    return false;
  }
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

export function shouldShowRejectedBadge(
  starRating: number | null | undefined,
  showRejectedIndicator: boolean,
): boolean {
  return showRejectedIndicator && starRating === -1;
}

/** True when a rating exists that “Clear” can remove (1–5 stars or rejected -1). */
export function hasStarRatingToClear(
  starRating: number | null | undefined,
  showRejectedIndicator: boolean,
): boolean {
  return shouldShowStarCompactBadge(starRating) || shouldShowRejectedBadge(starRating, showRejectedIndicator);
}

export function MediaItemStarRating({
  starRating,
  onChange,
  showRejectedIndicator = false,
  expanded = false,
  tone = "onPhoto",
}: MediaItemStarRatingProps): ReactElement | null {
  const emptyStroke = starEmptyStroke(tone);
  const count = normalizedCount(starRating);
  const rejected = shouldShowRejectedBadge(starRating, showRejectedIndicator);
  const [hoverStar, setHoverStar] = useState<number | null>(null);

  const interactive = Boolean(onChange);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!interactive || !onChange) {
        return;
      }
      if (e.key === "0" || e.key === "Escape" || e.key === "Backspace" || e.key === "Delete") {
        if (!hasStarRatingToClear(starRating, showRejectedIndicator)) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        setHoverStar(null);
        onChange(0);
        return;
      }
      const d = e.key.length === 1 ? Number.parseInt(e.key, 10) : Number.NaN;
      if (d >= 1 && d <= 5) {
        e.preventDefault();
        e.stopPropagation();
        setHoverStar(null);
        onChange(d);
      }
    },
    [interactive, onChange, starRating, showRejectedIndicator],
  );

  if (!interactive && !shouldShowStarCompactBadge(starRating) && !rejected) {
    return null;
  }

  if (expanded && interactive && onChange) {
    const expandedBoxStyle: CSSProperties =
      tone === "onCard" ? { ...badgeOnCardStyle, backdropFilter: "none" } : badgeOnPhotoStyle;
    const showClearControl = hasStarRatingToClear(starRating, showRejectedIndicator);

    return (
      <div
        role="radiogroup"
        aria-label="Star rating"
        tabIndex={-1}
        style={expandedBoxStyle}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseLeave={() => setHoverStar(null)}
      >
        {showClearControl ? (
          <button
            type="button"
            aria-label="Clear star rating"
            title="Clear rating"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              marginRight: 2,
              border: "none",
              borderRadius: 4,
              background: "transparent",
              cursor: "pointer",
            }}
            onMouseEnter={() => setHoverStar(null)}
            onClick={(e) => {
              e.stopPropagation();
              setHoverStar(null);
              onChange(0);
            }}
          >
            <IconUnset size={18} stroke={tone === "onPhoto" ? "rgba(248,250,252,0.9)" : "hsl(var(--foreground))"} />
          </button>
        ) : null}
        <div style={{ ...rowStyle, gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={count === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              title={`${n} star${n === 1 ? "" : "s"}`}
              style={{
                display: "inline-flex",
                padding: 2,
                margin: 0,
                border: "none",
                borderRadius: 4,
                background: "transparent",
                cursor: "pointer",
              }}
              onMouseEnter={() => setHoverStar(n)}
              onClick={(e) => {
                e.stopPropagation();
                setHoverStar(null);
                onChange(n);
              }}
            >
              <IconStar
                variant={starPreviewState(n, count, hoverStar)}
                emptyStroke={emptyStroke}
                size={18}
              />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (rejected) {
    const fg = tone === "onPhoto" ? "#fca5a5" : "hsl(var(--destructive))";
    const box = tone === "onPhoto" ? badgeOnPhotoStyle : badgeOnCardStyle;
    return (
      <div style={box} onClick={(e) => e.stopPropagation()} aria-label="Rejected">
        <IconRejected size={16} color={fg} />
      </div>
    );
  }

  if (shouldShowStarCompactBadge(starRating)) {
    const box = tone === "onPhoto" ? badgeOnPhotoStyle : badgeOnCardStyle;
    return (
      <div style={box} onClick={(e) => e.stopPropagation()} aria-label={`Rating ${count} of 5`}>
        <IconStar variant="full" emptyStroke={emptyStroke} size={14} />
        <span style={{ color: tone === "onPhoto" ? "#f8fafc" : "hsl(var(--foreground))" }}>{count}</span>
      </div>
    );
  }

  return null;
}

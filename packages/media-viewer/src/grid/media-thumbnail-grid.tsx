"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import type { MediaThumbnailGridItem } from "../types";
import { MediaItemActionsMenu } from "./media-item-actions-menu";
import { MediaItemGridCard } from "./media-item-grid-card";

const REORDER_DRAG_TYPE = "text/plain";
const reorderPayload = (index: number): string => `emk-grid-reorder:${index}`;

function parseReorderPayload(data: string): number | null {
  const match = /^emk-grid-reorder:(\d+)$/.exec(data.trim());
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1] ?? "", 10);
}

function collectCellRects(cellRefs: readonly (HTMLElement | null)[]): DOMRect[] {
  const rects: DOMRect[] = [];
  for (const el of cellRefs) {
    if (!el) {
      continue;
    }
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      rects.push(r);
    }
  }
  return rects;
}

function computeInsertBeforeIndex(
  clientX: number,
  clientY: number,
  cellRefs: readonly (HTMLElement | null)[],
): number {
  const rects = collectCellRects(cellRefs);
  const n = rects.length;
  if (n === 0) {
    return 0;
  }
  const minTop = Math.min(...rects.map((r) => r.top));
  const maxBottom = Math.max(...rects.map((r) => r.bottom));
  const minLeft = Math.min(...rects.map((r) => r.left));
  const maxRight = Math.max(...rects.map((r) => r.right));

  if (clientY > maxBottom + 24) {
    return n;
  }
  if (clientY < minTop - 24) {
    return 0;
  }
  if (clientX < minLeft - 24) {
    return 0;
  }
  if (clientX > maxRight + 24) {
    return n;
  }

  for (let i = 0; i < n; i++) {
    const r = rects[i]!;
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
      const midX = (r.left + r.right) / 2;
      return clientX < midX ? i : i + 1;
    }
  }

  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < n; i++) {
    const r = rects[i]!;
    const cx = Math.min(Math.max(clientX, r.left), r.right);
    const cy = Math.min(Math.max(clientY, r.top), r.bottom);
    const d = (clientX - cx) ** 2 + (clientY - cy) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  const r = rects[best]!;
  const midX = (r.left + r.right) / 2;
  return clientX < midX ? best : best + 1;
}

function computeGapIndicatorRect(
  insertBefore: number,
  rects: DOMRect[],
  columnCount: number,
): { left: number; top: number; width: number; height: number } | null {
  const n = rects.length;
  if (insertBefore < 0 || insertBefore > n || n === 0) {
    return null;
  }
  const edge = 3;
  if (insertBefore === 0) {
    const r = rects[0]!;
    return { left: r.left - 1, top: r.top, width: edge, height: r.height };
  }
  if (insertBefore === n) {
    const r = rects[n - 1]!;
    return { left: r.right - edge + 1, top: r.top, width: edge, height: r.height };
  }
  const prev = rects[insertBefore - 1]!;
  const next = rects[insertBefore]!;
  const prevRow = Math.floor((insertBefore - 1) / columnCount);
  const nextRow = Math.floor(insertBefore / columnCount);
  if (prevRow === nextRow) {
    const mid = (prev.right + next.left) / 2;
    const top = Math.min(prev.top, next.top);
    const bottom = Math.max(prev.bottom, next.bottom);
    return { left: mid - edge / 2, top, width: edge, height: bottom - top };
  }
  const y = (prev.bottom + next.top) / 2;
  const left = Math.min(prev.left, next.left);
  const right = Math.max(prev.right, next.right);
  return { left, top: y - edge / 2, width: right - left, height: edge };
}

export interface MediaThumbnailGridDragReorder {
  /** `insertBeforeIndex` is in range `0..items.length` for the current `items` list. */
  onMove: (fromIndex: number, insertBeforeIndex: number) => void;
}

interface MediaThumbnailGridProps {
  items: MediaThumbnailGridItem[];
  onItemClick: (index: number) => void;
  showActionsMenu?: boolean;
  analyzeActionLabel?: string;
  onAnalyze?: (itemId: string) => void;
  disableAnalyzeAction?: boolean;
  renderActions?: (item: MediaThumbnailGridItem, index: number) => ReactNode;
  priorityCount?: number;
  /** When set, thumbnails reorder via drag (except star and actions hit targets). */
  dragReorder?: MediaThumbnailGridDragReorder;
  /**
   * When true (default), the grid is its own scroll container.
   * Set to false when embedding inside an already-scrollable parent to avoid nested scrollbars.
   */
  scrollable?: boolean;
}

interface DragPreviewState {
  imageUrl?: string | null;
  mediaType?: "image" | "video";
  title: string;
  left: number;
  top: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

const styles: Record<string, CSSProperties> = {
  grid: {
    display: "grid",
    gap: 16,
    gridAutoRows: "256px",
    alignContent: "start",
    alignItems: "start",
    padding: 16,
    overflow: "auto",
    flex: "1 1 auto",
    minHeight: 0,
    height: "100%",
  },
};

export function MediaThumbnailGrid({
  items,
  onItemClick,
  showActionsMenu = false,
  analyzeActionLabel = "Analyse photo with AI",
  onAnalyze,
  disableAnalyzeAction = false,
  renderActions,
  priorityCount = 4,
  dragReorder,
  scrollable = true,
}: MediaThumbnailGridProps): ReactElement {
  const [columnCount, setColumnCount] = useState(4);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragSourceIndexRef = useRef<number | null>(null);
  const [gapRect, setGapRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreviewState | null>(null);

  const clearReorderVisual = useCallback((): void => {
    dragSourceIndexRef.current = null;
    setGapRect(null);
    setDragPreview(null);
  }, []);

  const updateReorderHover = useCallback(
    (clientX: number, clientY: number): void => {
      if (!dragReorder || dragSourceIndexRef.current === null) {
        return;
      }
      const insertBefore = computeInsertBeforeIndex(clientX, clientY, cellRefs.current);
      const rects = collectCellRects(cellRefs.current);
      setGapRect(computeGapIndicatorRect(insertBefore, rects, columnCount));
      setDragPreview((current) =>
        current
          ? {
              ...current,
              left: clientX - current.offsetX,
              top: clientY - current.offsetY,
            }
          : current,
      );
    },
    [columnCount, dragReorder],
  );

  const finalizeDrop = useCallback(
    (event: DragEvent<HTMLDivElement>): void => {
      if (!dragReorder) {
        return;
      }
      event.preventDefault();
      const from = parseReorderPayload(event.dataTransfer.getData(REORDER_DRAG_TYPE));
      const insertBefore = computeInsertBeforeIndex(event.clientX, event.clientY, cellRefs.current);
      clearReorderVisual();
      if (from === null || from < 0 || from >= items.length) {
        return;
      }
      if (from !== insertBefore && from + 1 !== insertBefore) {
        dragReorder.onMove(from, insertBefore);
      }
    },
    [clearReorderVisual, dragReorder, items.length],
  );

  useEffect(() => {
    const updateColumnCount = () => {
      const width = window.innerWidth;
      if (width < 768) {
        setColumnCount(2);
        return;
      }
      if (width < 1024) {
        setColumnCount(3);
        return;
      }
      setColumnCount(4);
    };

    updateColumnCount();
    window.addEventListener("resize", updateColumnCount);
    return () => {
      window.removeEventListener("resize", updateColumnCount);
    };
  }, []);

  useEffect(() => {
    cellRefs.current.length = items.length;
  }, [items.length]);

  useEffect(() => {
    clearReorderVisual();
  }, [items, clearReorderVisual]);

  const reorderHoverHandlers = dragReorder
    ? {
        onDragOver: (event: DragEvent<HTMLDivElement>): void => {
          if (dragSourceIndexRef.current === null) {
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          updateReorderHover(event.clientX, event.clientY);
        },
        onDrop: finalizeDrop,
      }
    : {};

  return (
    <div
      style={{
        ...styles.grid,
        position: dragReorder ? "relative" : undefined,
        ...(scrollable
          ? null
          : {
              overflow: "visible",
              height: "auto",
              minHeight: "auto",
              flex: "0 0 auto",
            }),
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
      }}
      {...reorderHoverHandlers}
    >
      {items.map((item, index) => {
        const gridCard = (
          <MediaItemGridCard
            title={item.title}
            imageUrl={item.imageUrl}
            subtitle={item.subtitle}
            starRating={item.starRating}
            onStarRatingChange={item.onStarRatingChange}
            starRatingShowRejected={item.starRatingShowRejected}
            mediaType={item.mediaType}
            onClick={() => onItemClick(index)}
            priority={index < priorityCount}
            dragReorder={
              dragReorder
                ? {
                    onDragStart: (event) => {
                      event.dataTransfer.setData(REORDER_DRAG_TYPE, reorderPayload(index));
                      event.dataTransfer.effectAllowed = "move";
                      dragSourceIndexRef.current = index;
                      const rect = cellRefs.current[index]?.getBoundingClientRect();
                      if (rect) {
                        const width = Math.max(1, Math.round(rect.width));
                        const height = Math.max(1, Math.round(rect.height));
                        const offsetX = Math.min(width, Math.max(0, Math.round(event.clientX - rect.left)));
                        const offsetY = Math.min(height, Math.max(0, Math.round(event.clientY - rect.top)));
                        setDragPreview({
                          imageUrl: item.imageUrl,
                          mediaType: item.mediaType,
                          title: item.title,
                          left: event.clientX - offsetX,
                          top: event.clientY - offsetY,
                          width,
                          height,
                          offsetX,
                          offsetY,
                        });
                      }
                      updateReorderHover(event.clientX, event.clientY);
                    },
                    onDragEnd: () => {
                      clearReorderVisual();
                    },
                  }
                : undefined
            }
            actions={
              renderActions
                ? renderActions(item, index)
                : showActionsMenu
                  ? (
                      <MediaItemActionsMenu
                        actions={[
                          {
                            id: "analyze",
                            label: analyzeActionLabel,
                            icon: "✨",
                            disabled: disableAnalyzeAction,
                            onSelect: () => {
                              onAnalyze?.(item.id);
                            },
                          },
                        ]}
                      />
                    )
                  : undefined
            }
          />
        );

        if (!dragReorder) {
          return (
            <Fragment key={item.id}>
              {gridCard}
            </Fragment>
          );
        }

        return (
          <div
            key={item.id}
            ref={(el) => {
              cellRefs.current[index] = el;
            }}
            style={{ position: "relative", width: "100%" }}
            {...reorderHoverHandlers}
          >
            {gridCard}
          </div>
        );
      })}
      {dragPreview && dragReorder ? (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: dragPreview.left,
            top: dragPreview.top,
            width: dragPreview.width,
            height: dragPreview.height,
            opacity: 0.78,
            border: "3px solid #ffffff",
            borderRadius: 8,
            boxSizing: "border-box",
            overflow: "hidden",
            pointerEvents: "none",
            zIndex: 10001,
            backgroundColor: "#0f172a",
            boxShadow: "0 12px 32px rgba(2, 6, 23, 0.45)",
          }}
        >
          {dragPreview.imageUrl ? (
            dragPreview.mediaType === "video" ? (
              <video
                src={dragPreview.imageUrl}
                muted
                playsInline
                preload="metadata"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <img
                src={dragPreview.imageUrl}
                alt=""
                draggable={false}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            )
          ) : (
            <div
              style={{
                display: "flex",
                width: "100%",
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
                color: "#e2e8f0",
                fontSize: 14,
              }}
            >
              {dragPreview.mediaType === "video" ? "Video" : dragPreview.title}
            </div>
          )}
        </div>
      ) : null}
      {gapRect && dragReorder ? (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: gapRect.left,
            top: gapRect.top,
            width: gapRect.width,
            height: gapRect.height,
            backgroundColor: "#3b82f6",
            borderRadius: 1,
            zIndex: 10000,
            pointerEvents: "none",
            boxShadow: "0 0 0 1px rgba(15, 23, 42, 0.35)",
          }}
        />
      ) : null}
    </div>
  );
}

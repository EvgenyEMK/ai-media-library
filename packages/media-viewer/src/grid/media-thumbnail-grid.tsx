"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import type { MediaThumbnailGridItem } from "../types";
import { MediaItemActionsMenu } from "./media-item-actions-menu";
import { MediaItemGridCard } from "./media-item-grid-card";

interface MediaThumbnailGridProps {
  items: MediaThumbnailGridItem[];
  onItemClick: (index: number) => void;
  showActionsMenu?: boolean;
  analyzeActionLabel?: string;
  onAnalyze?: (itemId: string) => void;
  disableAnalyzeAction?: boolean;
  renderActions?: (item: MediaThumbnailGridItem, index: number) => ReactNode;
  priorityCount?: number;
  /**
   * When true (default), the grid is its own scroll container.
   * Set to false when embedding inside an already-scrollable parent to avoid nested scrollbars.
   */
  scrollable?: boolean;
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
  scrollable = true,
}: MediaThumbnailGridProps): ReactElement {
  const [columnCount, setColumnCount] = useState(4);

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

  return (
    <div
      style={{
        ...styles.grid,
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
    >
      {items.map((item, index) => (
        <MediaItemGridCard
          key={item.id}
          title={item.title}
          imageUrl={item.imageUrl}
          subtitle={item.subtitle}
          starRating={item.starRating}
          onStarRatingChange={item.onStarRatingChange}
          starRatingShowRejected={item.starRatingShowRejected}
          mediaType={item.mediaType}
          onClick={() => onItemClick(index)}
          priority={index < priorityCount}
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
      ))}
    </div>
  );
}

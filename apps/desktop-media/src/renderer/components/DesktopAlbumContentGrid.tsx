import { useCallback, useMemo, type ReactElement } from "react";
import { MediaThumbnailGrid } from "@emk/media-viewer";
import type { ReorderAlbumMediaItemParams } from "@emk/shared-contracts";
import {
  countActiveQuickFilters,
  getFaceDetectionMethod,
  matchesThumbnailQuickFilters,
  type ThumbnailQuickFilterInput,
  type ThumbnailQuickFilterState,
} from "@emk/media-metadata-core";
import type { AlbumMediaItem } from "@emk/shared-contracts";
import type { DesktopStore } from "../stores/desktop-store";
import { useMediaItemStarRatingChange } from "../hooks/use-media-item-star-rating-change";
import { toFileUrl } from "./face-cluster-utils";
import { PeoplePaginationBar, peoplePaginationTotalPages } from "./people-pagination-bar";
import { DesktopMediaItemActionsMenu } from "./DesktopMediaItemActionsMenu";
import { ALBUM_ITEMS_PAGE_SIZE, albumItemToViewerEntry } from "./DesktopAlbumDetailPanel";
import { lookupMediaMetadataByItemId } from "../lib/media-metadata-lookup";
import type { DesktopMediaItemMetadata } from "../../shared/ipc";
import { useDesktopStore } from "../stores/desktop-store";
import { DesktopMediaItemListRow } from "./DesktopMediaItemListRow";
import { formatPhotoTakenListLabel } from "../lib/photo-date-format";
import { cn } from "../lib/cn";

function thumbnailQuickFilterInputForPath(
  itemId: string,
  mediaMetadataByItemId: Record<string, unknown>,
): ThumbnailQuickFilterInput {
  const metadata = lookupMediaMetadataByItemId<DesktopMediaItemMetadata>(itemId, mediaMetadataByItemId);
  const faceDetectionMethod = getFaceDetectionMethod(metadata?.aiMetadata ?? null);
  const faceCountFromMetadata = metadata?.faceConfidences.length ?? 0;
  const detectedFaceCount = faceDetectionMethod || faceCountFromMetadata > 0 ? faceCountFromMetadata : null;

  return {
    metadata: metadata?.aiMetadata ?? null,
    detectedFaceCount,
    fileStarRating: metadata?.starRating ?? null,
    catalogEventDateStart: metadata?.eventDateStart ?? null,
    catalogEventDateEnd: metadata?.eventDateEnd ?? null,
    catalogCountry: metadata?.country ?? null,
    catalogCity: metadata?.city ?? null,
    catalogLocationArea: metadata?.locationArea ?? null,
    catalogLocationPlace: metadata?.locationPlace ?? null,
    catalogLocationName: metadata?.locationName ?? null,
  };
}

function renderListThumbnail(item: AlbumMediaItem): ReactElement {
  const imageUrl = toFileUrl(item.sourcePath);
  if (item.mediaKind === "video") {
    return (
      <video
        className="h-36 w-36 shrink-0 rounded object-cover"
        src={imageUrl}
        muted
        preload="metadata"
        playsInline
      />
    );
  }
  return (
    <img
      className="h-36 w-36 shrink-0 rounded object-cover"
      src={imageUrl}
      alt={item.title}
      loading="lazy"
      decoding="async"
    />
  );
}

function albumPaginationBarVisible(totalItems: number, pageSize: number): boolean {
  const totalPages = peoplePaginationTotalPages(totalItems, pageSize);
  return !(totalPages <= 1 && totalItems <= pageSize);
}

export function DesktopAlbumContentGrid({
  store,
  albumId,
  albumItems,
  albumItemsPage,
  albumItemsTotal,
  quickFilters,
  viewMode,
  onAlbumItemsPageChange,
  onAlbumContentChanged,
  reorderAlbumMediaItem,
  onFindSimilar,
  emptyAlbumMessage,
  emptyAlbumMessageEmphasis,
  thumbScrollPaddingClass,
}: {
  store: DesktopStore;
  albumId?: string;
  albumItems: AlbumMediaItem[];
  albumItemsPage: number;
  albumItemsTotal: number;
  quickFilters: ThumbnailQuickFilterState;
  viewMode: "grid" | "list";
  onAlbumItemsPageChange: (page: number) => void;
  onAlbumContentChanged?: () => void;
  /** When set with `albumId` and no active quick filters, grid view allows drag-reorder (manual albums). */
  reorderAlbumMediaItem?: (params: ReorderAlbumMediaItemParams) => Promise<void>;
  onFindSimilar?: (filePath: string) => void;
  /** Overrides the default empty-album copy when there are no items. */
  emptyAlbumMessage?: string;
  /** When true with `emptyAlbumMessage`, empty copy uses larger amber styling. */
  emptyAlbumMessageEmphasis?: boolean;
  /** Extra classes on the scrollable thumb/list region (e.g. smart album horizontal inset). */
  thumbScrollPaddingClass?: string;
}): ReactElement {
  const mediaMetadataByItemId = useDesktopStore((s) => s.mediaMetadataByItemId);
  const dateFormat = useDesktopStore((s) => s.mediaViewerSettings.dateFormat);
  const commitStarRating = useMediaItemStarRatingChange();
  const quickFiltersActiveCount = useMemo(() => countActiveQuickFilters(quickFilters), [quickFilters]);
  const filteredAlbumItems = useMemo(() => {
    if (quickFiltersActiveCount === 0) {
      return albumItems;
    }
    return albumItems.filter((item) =>
      matchesThumbnailQuickFilters(
        thumbnailQuickFilterInputForPath(item.sourcePath, mediaMetadataByItemId),
        quickFilters,
      ),
    );
  }, [albumItems, mediaMetadataByItemId, quickFilters, quickFiltersActiveCount]);
  const viewerEntries = useMemo(() => filteredAlbumItems.map(albumItemToViewerEntry), [filteredAlbumItems]);
  const albumDragReorder =
    albumId &&
    reorderAlbumMediaItem &&
    quickFiltersActiveCount === 0 &&
    viewMode === "grid"
      ? {
          onMove: (fromLocal: number, insertBeforeLocal: number): void => {
            const row = filteredAlbumItems[fromLocal];
            if (!row || !albumId) {
              return;
            }
            const base = albumItemsPage * ALBUM_ITEMS_PAGE_SIZE;
            const globalInsertBefore = Math.min(base + insertBeforeLocal, albumItemsTotal);
            void reorderAlbumMediaItem({
              albumId,
              mediaItemId: row.id,
              insertBeforeIndex: globalInsertBefore,
            }).then(() => {
              onAlbumContentChanged?.();
            });
          },
        }
      : undefined;
  const onStarRatingChangeForPath = useCallback(
    (path: string) => (next: number) => {
      void commitStarRating(path, next);
    },
    [commitStarRating],
  );

  const showPagination = albumPaginationBarVisible(albumItemsTotal, ALBUM_ITEMS_PAGE_SIZE);

  const paginationFooter = (
    <div className="shrink-0 border-t border-border bg-background px-4 py-2">
      <PeoplePaginationBar
        ariaLabel="Album items pagination"
        currentPage={albumItemsPage}
        totalItems={albumItemsTotal}
        pageSize={ALBUM_ITEMS_PAGE_SIZE}
        onPageChange={onAlbumItemsPageChange}
      />
    </div>
  );

  if (albumItems.length === 0) {
    const emptyCopy = emptyAlbumMessage ?? "This album is empty.";
    const emphasizeEmpty = emptyAlbumMessageEmphasis === true && Boolean(emptyAlbumMessage);
    const showStandardAlbumAddHint = Boolean(albumId) && emptyAlbumMessage === undefined;
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          <div className="max-w-md text-center">
            <p
              className={cn(
                "m-0",
                emphasizeEmpty
                  ? "text-base font-medium text-amber-600 dark:text-amber-400 md:text-lg"
                  : "text-sm text-muted-foreground",
              )}
            >
              {emptyCopy}
            </p>
            {showStandardAlbumAddHint ? (
              <p className="m-0 mt-3 text-sm leading-relaxed text-muted-foreground">
                Open a folder, select photos you want to add, then use{" "}
                <span className="font-medium text-foreground">Open media item actions</span> (⋯) on a thumbnail and
                choose <span className="font-medium text-foreground">Albums</span> to add items to one or more albums.
              </p>
            ) : null}
          </div>
        </div>
        {showPagination ? paginationFooter : null}
      </div>
    );
  }

  if (filteredAlbumItems.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          <div className="max-w-md text-center text-sm text-muted-foreground">
            No album items match the current filters.
          </div>
        </div>
        {showPagination ? paginationFooter : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={cn("min-h-0 flex-1 overflow-auto", thumbScrollPaddingClass ?? "")}>
        {viewMode === "grid" ? (
          <MediaThumbnailGrid
            items={filteredAlbumItems.map((item) => ({
              id: item.sourcePath,
              title: item.title,
              imageUrl: toFileUrl(item.sourcePath),
              starRating: item.starRating,
              onStarRatingChange: onStarRatingChangeForPath(item.sourcePath),
              mediaType: item.mediaKind,
            }))}
            onItemClick={(index) => {
              store.getState().openViewer(index, "album", {
                itemListOverride: viewerEntries,
                autoPlayInitialVideo: filteredAlbumItems[index]?.mediaKind === "video",
              });
            }}
            renderActions={(item) => (
              <DesktopMediaItemActionsMenu
                filePath={item.id}
                mediaType={item.mediaType}
                albumContext={
                  albumId
                    ? {
                        albumId,
                        onAlbumChanged: onAlbumContentChanged,
                      }
                    : undefined
                }
                onFindSimilar={onFindSimilar}
              />
            )}
            dragReorder={albumDragReorder}
            priorityCount={24}
            scrollable={false}
          />
        ) : (
          <div
            className={cn(
              "grid grid-cols-1 gap-2 overflow-visible lg:grid-cols-2 lg:gap-3",
              thumbScrollPaddingClass ?? "p-4",
            )}
          >
            {filteredAlbumItems.map((item, index) =>
              (() => {
                const metadata = lookupMediaMetadataByItemId<DesktopMediaItemMetadata>(
                  item.sourcePath,
                  mediaMetadataByItemId,
                );
                return (
                  <DesktopMediaItemListRow
                    key={item.id}
                    title={item.title}
                    metadataLine={formatPhotoTakenListLabel(
                      metadata?.photoTakenAt ?? null,
                      metadata?.fileCreatedAt ?? null,
                      metadata?.photoTakenPrecision ?? null,
                      dateFormat,
                    )}
                    filePath={item.sourcePath}
                    mediaType={item.mediaKind}
                    thumbnail={renderListThumbnail(item)}
                    starRating={item.starRating}
                    onStarRatingChange={onStarRatingChangeForPath(item.sourcePath)}
                    albumContext={
                      albumId
                        ? {
                            albumId,
                            onAlbumChanged: onAlbumContentChanged,
                          }
                        : undefined
                    }
                    onRowClick={() => {
                      store.getState().openViewer(index, "album", {
                        itemListOverride: viewerEntries,
                        autoPlayInitialVideo: item.mediaKind === "video",
                      });
                    }}
                    onFindSimilar={onFindSimilar}
                  />
                );
              })(),
            )}
          </div>
        )}
      </div>
      {showPagination ? paginationFooter : null}
    </div>
  );
}

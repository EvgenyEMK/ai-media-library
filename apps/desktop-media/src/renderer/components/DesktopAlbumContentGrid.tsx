import { useCallback, useMemo, type ReactElement } from "react";
import { MediaThumbnailGrid } from "@emk/media-viewer";
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
import { PeoplePaginationBar } from "./people-pagination-bar";
import { DesktopMediaItemActionsMenu } from "./DesktopMediaItemActionsMenu";
import { ALBUM_ITEMS_PAGE_SIZE, albumItemToViewerEntry } from "./DesktopAlbumDetailPanel";
import { lookupMediaMetadataByItemId } from "../lib/media-metadata-lookup";
import type { DesktopMediaItemMetadata } from "../../shared/ipc";
import { useDesktopStore } from "../stores/desktop-store";
import { DesktopMediaItemListRow } from "./DesktopMediaItemListRow";
import { formatPhotoTakenListLabel } from "../lib/photo-date-format";

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
}): ReactElement {
  const mediaMetadataByItemId = useDesktopStore((s) => s.mediaMetadataByItemId);
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
  const onStarRatingChangeForPath = useCallback(
    (path: string) => (next: number) => {
      void commitStarRating(path, next);
    },
    [commitStarRating],
  );

  if (albumItems.length === 0) {
    return (
      <div className="m-4 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        This album is empty.
      </div>
    );
  }

  if (filteredAlbumItems.length === 0) {
    return (
      <div className="m-4 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No album items match the current filters.
      </div>
    );
  }

  return (
    <>
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
          renderActions={
            albumId
              ? (item) => (
                  <DesktopMediaItemActionsMenu
                    filePath={item.id}
                    mediaType={item.mediaType}
                    albumContext={{
                      albumId,
                      onAlbumChanged: onAlbumContentChanged,
                    }}
                  />
                )
              : undefined
          }
          priorityCount={24}
          scrollable={false}
        />
      ) : (
        <div className="grid grid-cols-1 gap-2 overflow-visible p-4 lg:grid-cols-2 lg:gap-3">
          {filteredAlbumItems.map((item, index) => (
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
                />
              );
            })()
          ))}
        </div>
      )}
      <div className="px-4 pb-4">
        <PeoplePaginationBar
          ariaLabel="Album items pagination"
          currentPage={albumItemsPage}
          totalItems={albumItemsTotal}
          pageSize={ALBUM_ITEMS_PAGE_SIZE}
          onPageChange={onAlbumItemsPageChange}
        />
      </div>
    </>
  );
}

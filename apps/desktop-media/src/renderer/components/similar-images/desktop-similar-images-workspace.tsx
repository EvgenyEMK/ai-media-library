import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { ArrowLeft } from "lucide-react";
import { MediaThumbnailGrid } from "@emk/media-viewer";
import type { DesktopMediaItemMetadata, FindSimilarImagesResultRow } from "../../../shared/ipc";
import type { ViewerItemListEntry } from "@emk/media-store";
import { PeoplePaginationBar } from "../people-pagination-bar";
import { DesktopMediaItemListRow } from "../DesktopMediaItemListRow";
import { toFileUrl } from "../face-cluster-utils";
import { ALBUM_ITEMS_PAGE_SIZE } from "../DesktopAlbumDetailPanel";
import { cn } from "../../lib/cn";
import { formatImageSimilarityPercent } from "../../lib/format-image-similarity-percent";
import { formatPhotoTakenListLabel } from "../../lib/photo-date-format";
import { lookupMediaMetadataByItemId } from "../../lib/media-metadata-lookup";
import { useMediaItemStarRatingChange } from "../../hooks/use-media-item-star-rating-change";
import type { DesktopStore } from "../../stores/desktop-store";
import { useDesktopStore } from "../../stores/desktop-store";
import { SimilarImagesViewModeToggle } from "./similar-images-view-mode-toggle";

export const SIMILAR_IMAGES_THRESHOLD_PERCENTS = [95, 90, 85, 80, 75, 70] as const;

export const SIMILAR_IMAGES_PAGE_SIZE = ALBUM_ITEMS_PAGE_SIZE;

function renderListThumbnail(imageUrl: string | null | undefined, title: string, mediaType: "image" | "video"): ReactElement {
  if (mediaType === "video") {
    return (
      <video
        className="h-36 w-36 shrink-0 rounded object-cover"
        src={imageUrl ?? undefined}
        muted
        preload="metadata"
        playsInline
      />
    );
  }
  return (
    <img
      className="h-36 w-36 shrink-0 rounded object-cover"
      src={imageUrl ?? undefined}
      alt={title}
      loading="lazy"
      decoding="async"
    />
  );
}

function inferMediaTypeFromPath(filePath: string): "image" | "video" {
  return /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(filePath) ? "video" : "image";
}

export interface SimilarImagesSession {
  sourcePath: string;
  minSimilarity: number;
}

export function DesktopSimilarImagesWorkspace({
  store,
  session,
  currentPage,
  onPageChange,
  onClose,
  onMinSimilarityChange,
}: {
  store: DesktopStore;
  session: SimilarImagesSession;
  currentPage: number;
  onPageChange: (page: number) => void;
  onClose: () => void;
  onMinSimilarityChange: (minSimilarity: number) => void;
}): ReactElement {
  const viewMode = useDesktopStore((s) => s.viewMode);
  const mediaMetadataByItemId = useDesktopStore((s) => s.mediaMetadataByItemId);
  const dateFormat = useDesktopStore((s) => s.mediaViewerSettings.dateFormat);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<FindSimilarImagesResultRow[]>([]);
  const commitStarRating = useMediaItemStarRatingChange();
  const onStarRatingChangeForPath = useCallback(
    (path: string) => (next: number) => {
      void commitStarRating(path, next);
    },
    [commitStarRating],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void window.desktopApi
      .findSimilarImages({
        sourcePath: session.sourcePath,
        minSimilarity: session.minSimilarity,
      })
      .then((response) => {
        if (cancelled) return;
        if (response.ok) {
          setResults(response.results);
        } else {
          setResults([]);
          setError(response.error);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setResults([]);
        setError("Could not load similar images.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session.sourcePath, session.minSimilarity]);

  const viewerEntries: ViewerItemListEntry[] = useMemo(
    () =>
      results.map((row) => {
        const url = toFileUrl(row.path);
        const mediaType = inferMediaTypeFromPath(row.path);
        return {
          id: row.path,
          sourcePath: row.path,
          title: row.name,
          storage_url: url,
          thumbnail_url: url,
          mediaItemId: row.mediaItemId,
          mediaType,
        };
      }),
    [results],
  );

  const totalPages = Math.max(1, Math.ceil(results.length / SIMILAR_IMAGES_PAGE_SIZE));
  const safePage = Math.min(Math.max(0, currentPage), totalPages - 1);
  const pageSlice = useMemo(() => {
    const start = safePage * SIMILAR_IMAGES_PAGE_SIZE;
    return results.slice(start, start + SIMILAR_IMAGES_PAGE_SIZE);
  }, [results, safePage]);

  useEffect(() => {
    if (results.length === 0) return;
    const maxPage = Math.max(0, Math.ceil(results.length / SIMILAR_IMAGES_PAGE_SIZE) - 1);
    if (currentPage > maxPage) {
      onPageChange(maxPage);
    }
  }, [results.length, currentPage, onPageChange]);

  const openViewerAtGlobalIndex = useCallback(
    (globalIndex: number): void => {
      store.getState().openViewer(globalIndex, "search", {
        itemListOverride: viewerEntries,
        autoPlayInitialVideo:
          inferMediaTypeFromPath(results[globalIndex]?.path ?? "") === "video",
      });
    },
    [results, store, viewerEntries],
  );

  const thresholdChip = (percent: number): ReactElement => {
    const min = percent / 100;
    const selected = Math.abs(session.minSimilarity - min) < 0.0001;
    return (
      <button
        key={percent}
        type="button"
        className={cn(
          "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground hover:bg-muted",
        )}
        onClick={() => onMinSimilarityChange(min)}
      >
        {percent}%
      </button>
    );
  };

  let body: ReactNode;
  if (loading) {
    body = (
      <div className="flex items-center gap-2 p-6 text-muted-foreground" role="status">
        <div
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-primary"
          aria-hidden
        />
        <span>Finding similar images…</span>
      </div>
    );
  } else if (error) {
    body = <div className="p-6 text-sm text-destructive">{error}</div>;
  } else if (results.length === 0) {
    body = (
      <div className="p-6 text-sm text-muted-foreground">
        No images match this similarity level. Try a lower threshold or index more photos for AI search.
      </div>
    );
  } else if (viewMode === "grid") {
    body = (
      <div className="min-h-0 min-w-0 flex-1 px-2 pb-2">
        <MediaThumbnailGrid
          items={pageSlice.map((row) => {
            const meta = lookupMediaMetadataByItemId<DesktopMediaItemMetadata>(row.path, mediaMetadataByItemId);
            const mediaType =
              meta?.mediaKind === "video" || inferMediaTypeFromPath(row.path) === "video" ? "video" : "image";
            return {
              id: row.path,
              title: row.name,
              imageUrl: toFileUrl(row.path),
              starRating: typeof meta?.starRating === "number" ? meta.starRating : null,
              onStarRatingChange: onStarRatingChangeForPath(row.path),
              starRatingShowRejected: false,
              mediaType,
            };
          })}
          onItemClick={(localIndex) => {
            const globalIndex = safePage * SIMILAR_IMAGES_PAGE_SIZE + localIndex;
            openViewerAtGlobalIndex(globalIndex);
          }}
          showActionsMenu={false}
          priorityCount={24}
          scrollable={false}
        />
      </div>
    );
  } else {
    body = (
      <div className="grid grid-cols-1 gap-2 overflow-visible p-4 lg:grid-cols-2 lg:gap-3">
        {pageSlice.map((row, localIndex) => {
          const meta = lookupMediaMetadataByItemId<DesktopMediaItemMetadata>(row.path, mediaMetadataByItemId);
          const rowMediaType =
            meta?.mediaKind === "video" || inferMediaTypeFromPath(row.path) === "video" ? "video" : "image";
          const globalIndex = safePage * SIMILAR_IMAGES_PAGE_SIZE + localIndex;
          return (
            <DesktopMediaItemListRow
              key={row.path}
              title={row.name}
              onRowClick={() => openViewerAtGlobalIndex(globalIndex)}
              metadataLine={formatPhotoTakenListLabel(
                meta?.photoTakenAt ?? null,
                meta?.fileCreatedAt ?? null,
                meta?.photoTakenPrecision ?? null,
                dateFormat,
              )}
              extraLines={[`Similarity: ${formatImageSimilarityPercent(row.score)}`]}
              filePath={row.path}
              mediaType={rowMediaType}
              starRating={typeof meta?.starRating === "number" ? meta.starRating : null}
              onStarRatingChange={onStarRatingChangeForPath(row.path)}
              starRatingShowRejected={false}
              thumbnail={renderListThumbnail(toFileUrl(row.path), row.name, rowMediaType)}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-md border border-border hover:bg-muted"
          onClick={onClose}
          aria-label="Back"
          title="Back"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <h2 className="text-lg font-semibold text-foreground">Similar images</h2>
        <SimilarImagesViewModeToggle viewMode={viewMode} onViewModeChange={(mode) => store.getState().setViewMode(mode)} />
      </div>
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Similarity level
        </div>
        <div className="flex flex-wrap gap-2">{SIMILAR_IMAGES_THRESHOLD_PERCENTS.map(thresholdChip)}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{body}</div>
      {!loading && !error && results.length > 0 ? (
        <div className="shrink-0 px-4 pb-4 pt-2">
          <PeoplePaginationBar
            ariaLabel="Similar images pagination"
            currentPage={safePage}
            totalItems={results.length}
            pageSize={SIMILAR_IMAGES_PAGE_SIZE}
            onPageChange={onPageChange}
          />
        </div>
      ) : null}
    </div>
  );
}

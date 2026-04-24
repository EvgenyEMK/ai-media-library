import { useMemo } from "react";
import type { ImageEditSuggestion, ImageEditSuggestionsItem } from "@emk/media-viewer";
import {
  countActiveQuickFilters,
  getAdditionalTopLevelFields,
  getFaceDetectionMethod,
  matchesThumbnailQuickFilters,
  type ThumbnailQuickFilterInput,
  type ThumbnailQuickFilterState,
} from "@emk/media-metadata-core";
import type { SemanticSearchResult } from "@emk/media-store";
import type { DesktopMediaItemMetadata } from "../../shared/ipc";
import { passesAiImageSearchSimilarityGate } from "../lib/ai-search-similarity-gate";
import { formatPhotoTakenListLabel } from "../lib/photo-date-format";
import { lookupMediaMetadataByItemId } from "../lib/media-metadata-lookup";
import { useDesktopStore } from "../stores/desktop-store";
import type { DesktopViewerItem } from "../types/viewer-types";

function thumbnailQuickFilterInputForPath(
  itemId: string,
  mediaMetadataByItemId: Record<string, unknown>,
): ThumbnailQuickFilterInput {
  const metadata = lookupMediaMetadataByItemId<DesktopMediaItemMetadata>(itemId, mediaMetadataByItemId);
  const faceDetectionMethod = getFaceDetectionMethod(metadata?.aiMetadata ?? null);
  const faceCountFromMetadata = metadata?.faceConfidences.length ?? 0;
  const detectedFaceCount =
    faceDetectionMethod || faceCountFromMetadata > 0 ? faceCountFromMetadata : null;

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

export type DesktopFilteredMediaItem = {
  id: string;
  title: string;
  imageUrl?: string | null;
  subtitle?: string;
  photoTakenDisplay: string;
  starRating: number | null;
  mediaType: "image" | "video";
};

export type DesktopSemanticListItem = SemanticSearchResult & {
  photoTakenDisplay: string;
  starRating: number | null;
};

function getOrientationDetectionRotation(
  extras: Record<string, unknown>,
): 90 | 180 | 270 | null {
  const orientationNode =
    extras.orientation_detection && typeof extras.orientation_detection === "object"
      ? (extras.orientation_detection as Record<string, unknown>)
      : null;
  const angle = orientationNode?.correction_angle_clockwise;
  return angle === 90 || angle === 180 || angle === 270 ? angle : null;
}

export function useFilteredMediaItems(quickFilters: ThumbnailQuickFilterState): {
  filteredMediaItems: DesktopFilteredMediaItem[];
  displaySemanticResults: SemanticSearchResult[];
  /** Same as `displaySemanticResults` after similarity gate, then quick filters (for grid + viewer). */
  filteredDisplaySemanticResults: SemanticSearchResult[];
  /** Search results with date strings for list view rows. */
  filteredSemanticListItems: DesktopSemanticListItem[];
  viewerItems: DesktopViewerItem[];
  imageEditSuggestionItems: ImageEditSuggestionsItem[];
  quickFiltersActiveCount: number;
} {
  const mediaItems = useDesktopStore((s) => s.mediaItems);
  const mediaMetadataByItemId = useDesktopStore((s) => s.mediaMetadataByItemId);
  const viewerSource = useDesktopStore((s) => s.viewerSource);
  const semanticResults = useDesktopStore((s) => s.semanticResults);
  const hideVlm = useDesktopStore((s) => s.aiImageSearchSettings.hideResultsBelowVlmSimilarity);
  const hideDesc = useDesktopStore(
    (s) => s.aiImageSearchSettings.hideResultsBelowDescriptionSimilarity,
  );
  const semanticSearchSignalMode = useDesktopStore((s) => s.semanticSearchSignalMode);
  const experimentalAdvancedSearch = useDesktopStore(
    (s) => s.aiImageSearchSettings.keywordMatchReranking,
  );
  const effectiveSearchSignalMode = experimentalAdvancedSearch
    ? semanticSearchSignalMode
    : "hybrid";
  const viewerItemsOverride = useDesktopStore((s) => s.viewerItemsOverride);

  const displaySemanticResults = useMemo((): SemanticSearchResult[] => {
    return semanticResults.filter((r) =>
      passesAiImageSearchSimilarityGate(r, hideVlm, hideDesc, effectiveSearchSignalMode),
    );
  }, [semanticResults, hideVlm, hideDesc, effectiveSearchSignalMode]);

  const quickFiltersActiveCount = useMemo(
    () => countActiveQuickFilters(quickFilters),
    [quickFilters],
  );

  const mediaItemsWithListFields = useMemo((): DesktopFilteredMediaItem[] => {
    return mediaItems.map((item) => {
      const metadata = lookupMediaMetadataByItemId<DesktopMediaItemMetadata>(item.id, mediaMetadataByItemId);
      return {
        ...item,
        photoTakenDisplay: formatPhotoTakenListLabel(
          metadata?.photoTakenAt ?? null,
          metadata?.fileCreatedAt ?? null,
          metadata?.photoTakenPrecision ?? null,
        ),
        starRating: typeof metadata?.starRating === "number" ? metadata.starRating : null,
        mediaType:
          metadata?.mediaKind === "video" || item.mediaType === "video" ? "video" : "image",
      };
    });
  }, [mediaItems, mediaMetadataByItemId]);

  const filteredMediaItems = useMemo(() => {
    if (quickFiltersActiveCount === 0) {
      return mediaItemsWithListFields;
    }

    return mediaItemsWithListFields.filter((item) =>
      matchesThumbnailQuickFilters(
        thumbnailQuickFilterInputForPath(item.id, mediaMetadataByItemId),
        quickFilters,
      ),
    );
  }, [mediaItemsWithListFields, mediaMetadataByItemId, quickFilters, quickFiltersActiveCount]);

  const filteredDisplaySemanticResults = useMemo((): SemanticSearchResult[] => {
    if (quickFiltersActiveCount === 0) {
      return displaySemanticResults;
    }
    return displaySemanticResults.filter((r) =>
      matchesThumbnailQuickFilters(
        {
          ...thumbnailQuickFilterInputForPath(r.id, mediaMetadataByItemId),
          semanticPeopleDetected: r.peopleDetected ?? null,
        },
        quickFilters,
      ),
    );
  }, [displaySemanticResults, mediaMetadataByItemId, quickFilters, quickFiltersActiveCount]);

  const filteredSemanticListItems = useMemo((): DesktopSemanticListItem[] => {
    return filteredDisplaySemanticResults.map((r) => {
      const metadata = lookupMediaMetadataByItemId<DesktopMediaItemMetadata>(r.id, mediaMetadataByItemId);
      return {
        ...r,
        photoTakenDisplay: formatPhotoTakenListLabel(
          metadata?.photoTakenAt ?? null,
          metadata?.fileCreatedAt ?? null,
          metadata?.photoTakenPrecision ?? null,
        ),
        starRating: typeof metadata?.starRating === "number" ? metadata.starRating : null,
      };
    });
  }, [filteredDisplaySemanticResults, mediaMetadataByItemId]);

  const viewerItems = useMemo((): DesktopViewerItem[] => {
    if (viewerItemsOverride && viewerItemsOverride.length > 0) {
      return viewerItemsOverride.map((entry) => ({
        id: entry.id,
        mediaItemId: entry.mediaItemId ?? null,
        title: entry.title,
        storage_url: entry.storage_url,
        thumbnail_url: entry.thumbnail_url,
        width: entry.width ?? null,
        height: entry.height ?? null,
        sourcePath: entry.sourcePath,
        mediaType: entry.mediaType === "video" ? "video" : "image",
      }));
    }
    const images = viewerSource === "search" ? filteredDisplaySemanticResults : mediaItems;
    return images.map((image) => {
      const metadata = lookupMediaMetadataByItemId<DesktopMediaItemMetadata>(image.id, mediaMetadataByItemId);
      return {
        id: image.id,
        mediaItemId: metadata?.id ?? null,
        title: image.title,
        storage_url: image.imageUrl ?? "",
        thumbnail_url: image.imageUrl ?? "",
        width: metadata?.width ?? null,
        height: metadata?.height ?? null,
        sourcePath: image.id,
        mediaType:
          metadata?.mediaKind === "video" || image.mediaType === "video" ? "video" : "image",
      };
    });
  }, [
    mediaItems,
    filteredDisplaySemanticResults,
    viewerSource,
    mediaMetadataByItemId,
    viewerItemsOverride,
  ]);

  const imageEditSuggestionItems = useMemo((): ImageEditSuggestionsItem[] => {
    return mediaItems
      .filter((item) => item.mediaType !== "video")
      .map((item) => {
      const metadata = lookupMediaMetadataByItemId<DesktopMediaItemMetadata>(item.id, mediaMetadataByItemId);
      const extras = getAdditionalTopLevelFields(metadata?.aiMetadata ?? null);
      const suggestions = Array.isArray(extras.edit_suggestions)
        ? extras.edit_suggestions
            .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
            .map((entry): ImageEditSuggestion | null => {
              const editType = typeof entry.edit_type === "string" ? entry.edit_type : null;
              if (!editType || editType === "rotate") {
                return null;
              }
              const priority =
                entry.priority === "high" || entry.priority === "medium" || entry.priority === "low"
                  ? entry.priority
                  : null;
              const reason = typeof entry.reason === "string" ? entry.reason : null;
              const rotationRaw =
                typeof entry.rotation === "object" && entry.rotation !== null
                  ? (entry.rotation as Record<string, unknown>).angle_degrees_clockwise
                  : null;
              const rotationAngleClockwise =
                rotationRaw === 90 || rotationRaw === 180 || rotationRaw === 270 ? rotationRaw : null;
              const cropRaw = typeof entry.crop_rel === "object" && entry.crop_rel !== null
                ? (entry.crop_rel as Record<string, unknown>)
                : null;
              const cropRel =
                cropRaw &&
                typeof cropRaw.x === "number" &&
                typeof cropRaw.y === "number" &&
                typeof cropRaw.width === "number" &&
                typeof cropRaw.height === "number"
                  ? {
                      x: cropRaw.x,
                      y: cropRaw.y,
                      width: cropRaw.width,
                      height: cropRaw.height,
                    }
                  : null;
              return {
                editType,
                priority,
                reason,
                rotationAngleClockwise,
                cropRel,
              };
            })
            .filter((entry): entry is ImageEditSuggestion => entry !== null)
        : [];
      const orientationRotation = getOrientationDetectionRotation(extras);
      if (orientationRotation !== null) {
        suggestions.unshift({
          editType: "rotate",
          priority: "high",
          reason: "Orientation detection suggests rotating this image.",
          rotationAngleClockwise: orientationRotation,
          cropRel: null,
        });
      }

      return {
        id: item.id,
        title: item.title,
        imageUrl: item.imageUrl,
        suggestions,
      };
      });
  }, [mediaItems, mediaMetadataByItemId]);

  return {
    filteredMediaItems,
    displaySemanticResults,
    filteredDisplaySemanticResults,
    filteredSemanticListItems,
    viewerItems,
    imageEditSuggestionItems,
    quickFiltersActiveCount,
  };
}

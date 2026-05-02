import { useCallback, useEffect, useState, type ReactElement, type Dispatch, type SetStateAction } from "react";
import { BarChart3 } from "lucide-react";
import {
  ImageEditSuggestionsView,
  MediaThumbnailGrid,
  type ImageEditSuggestionsItem,
} from "@emk/media-viewer";
import type { SemanticSearchResult } from "@emk/media-store";
import type {
  DesktopFilteredMediaItem,
  DesktopSemanticListItem,
} from "../hooks/use-filtered-media-items";
import { DesktopFaceModelDownloadBanner } from "./DesktopFaceModelDownloadBanner";
import { DesktopMediaItemActionsMenu } from "./DesktopMediaItemActionsMenu";
import { DesktopMediaItemListRow } from "./DesktopMediaItemListRow";
import { DesktopFolderAiSummaryView } from "./DesktopFolderAiSummaryView";
import { DesktopMetadataScanFollowUpBar } from "./DesktopMetadataScanFollowUpBar";
import { DesktopMetadataManualScanResultPanel } from "./DesktopMetadataManualScanResultPanel";
import { SemanticSearchPanel } from "./SemanticSearchPanel";
import type { DesktopPipelineHandlers } from "../hooks/use-desktop-pipeline-handlers";
import { useMediaItemStarRatingChange } from "../hooks/use-media-item-star-rating-change";
import { useRotationReviewItems } from "../hooks/use-rotation-review-items";
import { formatSemanticCosinePercent } from "../lib/format-semantic-similarity";
import { MEDIA_PANE_EMPTY_STATE_CLASS } from "../lib/media-pane-ui";
import { lookupMediaMetadataByItemId } from "../lib/media-metadata-lookup";
import { UI_TEXT } from "../lib/ui-text";
import type { DesktopMediaItemMetadata } from "../../shared/ipc";
import { useDesktopStore, type DesktopStore, type DesktopStoreState } from "../stores/desktop-store";
import type { MainPaneViewMode, RotationReviewScope } from "../types/app-types";

/** Future: surface Adobe-style rejected (-1) in grid/list; kept off until pick/reject UX ships. */
const STAR_RATING_SHOW_REJECTED_UI = false;
const ROTATION_REVIEW_PAGE_SIZE = 24;

function renderListThumbnail(
  imageUrl: string | null | undefined,
  title: string,
  mediaType: "image" | "video",
): ReactElement {
  if (!imageUrl) {
    return (
      <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded bg-muted text-center text-xs text-muted-foreground">
        Preview unavailable
      </div>
    );
  }

  if (mediaType === "video") {
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
      alt={title}
      loading="lazy"
      decoding="async"
    />
  );
}

interface DesktopMediaWorkspaceProps {
  store: DesktopStore;
  mainPaneViewMode: MainPaneViewMode;
  setMainPaneViewMode: Dispatch<SetStateAction<MainPaneViewMode>>;
  rotationReviewScope: RotationReviewScope | null;
  setRotationReviewScope: Dispatch<SetStateAction<RotationReviewScope | null>>;
  onOpenRotationReview: (folderPath: string, includeSubfolders: boolean) => void;
  selectedFolder: string | null;
  semanticPanelOpen: boolean;
  faceModelDownload: DesktopStoreState["faceModelDownload"];
  pipeline: DesktopPipelineHandlers;
  handleOpenFolderAiSummary: (folderPath: string) => void;
  imageEditSuggestionItems: ImageEditSuggestionsItem[];
  mediaItemsLength: number;
  isFolderLoading: boolean;
  folderLoadProgress: { loaded: number; total: number | null };
  filteredMediaItems: DesktopFilteredMediaItem[];
  viewMode: DesktopStoreState["viewMode"];
  semanticModeActive: boolean;
  semanticResults: SemanticSearchResult[];
  displaySemanticResults: SemanticSearchResult[];
  filteredDisplaySemanticResults: SemanticSearchResult[];
  filteredSemanticListItems: DesktopSemanticListItem[];
  quickFiltersActiveCount: number;
  openFolderViewerById: (itemId: string) => void;
}

export function DesktopMediaWorkspace({
  store,
  mainPaneViewMode,
  setMainPaneViewMode,
  rotationReviewScope,
  setRotationReviewScope,
  onOpenRotationReview,
  selectedFolder,
  semanticPanelOpen,
  faceModelDownload,
  pipeline,
  handleOpenFolderAiSummary,
  imageEditSuggestionItems,
  mediaItemsLength,
  isFolderLoading,
  folderLoadProgress,
  filteredMediaItems,
  viewMode,
  semanticModeActive,
  semanticResults,
  displaySemanticResults,
  filteredDisplaySemanticResults,
  filteredSemanticListItems,
  quickFiltersActiveCount,
  openFolderViewerById: _openFolderViewerById,
}: DesktopMediaWorkspaceProps): ReactElement {
  const mediaMetadataByItemId = useDesktopStore((s) => s.mediaMetadataByItemId);
  const metadataManualScanResult = useDesktopStore((s) => s.metadataManualScanResult);
  const metadataScanFollowUp = useDesktopStore((s) => s.metadataScanFollowUp);
  const showSummaryOnEmptyFolderSelection = useDesktopStore(
    (s) => s.folderScanningSettings.showFolderAiSummaryWhenSelectingEmptyFolder,
  );
  const selectedFolderChildrenCount = useDesktopStore((s) =>
    selectedFolder ? (s.childrenByPath[selectedFolder]?.length ?? 0) : 0,
  );
  const [rotationReviewPage, setRotationReviewPage] = useState(1);
  const rotationReviewItems = useRotationReviewItems(
    rotationReviewScope,
    rotationReviewPage,
    ROTATION_REVIEW_PAGE_SIZE,
  );
  useEffect(() => {
    setRotationReviewPage(1);
  }, [rotationReviewScope?.folderPath, rotationReviewScope?.includeSubfolders]);
  const commitStarRating = useMediaItemStarRatingChange();
  const onStarRatingChangeForPath = useCallback(
    (path: string) => (next: number) => {
      void commitStarRating(path, next);
    },
    [commitStarRating],
  );
  const openFilteredItemInViewer = useCallback(
    (itemId: string) => {
      const allItems = store.getState().mediaItems;
      const sourceIndex = allItems.findIndex((entry) => entry.id === itemId);
      if (sourceIndex >= 0) {
        const item = allItems[sourceIndex];
        store.getState().openViewer(sourceIndex, "folder", {
          autoPlayInitialVideo: item?.mediaType === "video",
        });
        return;
      }
      const fallback = filteredMediaItems.find((entry) => entry.id === itemId);
      if (!fallback || !fallback.imageUrl) {
        return;
      }
      store.getState().openViewer(0, "folder", {
        autoPlayInitialVideo: fallback.mediaType === "video",
        itemListOverride: [
          {
            id: fallback.id,
            sourcePath: fallback.id,
            title: fallback.title,
            storage_url: fallback.imageUrl,
            thumbnail_url: fallback.imageUrl,
            mediaType: fallback.mediaType,
          },
        ],
      });
    },
    [filteredMediaItems, store],
  );
  const openRotationReviewItemInViewer = useCallback(
    (item: ImageEditSuggestionsItem): void => {
      if (!item.imageUrl) return;
      store.getState().openViewer(0, "folder", {
        itemListOverride: [
          {
            id: item.id,
            sourcePath: item.id,
            title: item.title,
            storage_url: item.imageUrl,
            thumbnail_url: item.imageUrl,
            mediaType: "image",
          },
        ],
      });
    },
    [store],
  );
  const showEmptyFolderSummaryCta =
    Boolean(selectedFolder) &&
    mediaItemsLength === 0 &&
    !isFolderLoading &&
    selectedFolderChildrenCount > 0 &&
    !showSummaryOnEmptyFolderSelection;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {!metadataManualScanResult && metadataScanFollowUp ? (
        <DesktopMetadataScanFollowUpBar layout="compact" pipeline={pipeline} />
      ) : null}
      {faceModelDownload.visible && faceModelDownload.status === "running" ? (
        <div className="shrink-0">
          <DesktopFaceModelDownloadBanner
            message={faceModelDownload.message || "Downloading AI face detection and recognition models..."}
            filename={faceModelDownload.filename}
            percent={faceModelDownload.percent}
            downloadedBytes={faceModelDownload.downloadedBytes}
            totalBytes={faceModelDownload.totalBytes}
          />
        </div>
      ) : null}
      {faceModelDownload.visible && faceModelDownload.status === "failed" ? (
        <div className="mx-4 my-2 shrink-0 rounded-lg border border-red-500/60 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          <div className="font-medium">
            {faceModelDownload.message || "Failed to download AI face detection model."}
          </div>
          {faceModelDownload.error ? (
            <div className="mt-1 text-xs text-red-300/90">{faceModelDownload.error}</div>
          ) : null}
        </div>
      ) : null}

      {mainPaneViewMode === "media" && semanticPanelOpen ? (
        <SemanticSearchPanel onSearch={() => void pipeline.handleSemanticSearch()} />
      ) : null}

      {metadataManualScanResult ? (
        <DesktopMetadataManualScanResultPanel pipeline={pipeline} />
      ) : (
      <div className="min-h-0 flex-1 overflow-auto">
        {mainPaneViewMode === "imageEditSuggestions" ? (
          rotationReviewScope ? (
            <ImageEditSuggestionsView
              hasFolderSelected
              variant="rotationReview"
              title="Wrongly rotated images"
              suggestedSummaryLabel="Wrongly rotated images"
              noSuggestionsMessage="No wrongly rotated images found for this folder."
              applyChangesNote="Review only - apply/save coming soon."
              items={rotationReviewItems.items}
              loading={rotationReviewItems.loading}
              error={rotationReviewItems.error}
              pagination={{
                page: rotationReviewPage,
                pageSize: ROTATION_REVIEW_PAGE_SIZE,
                total: rotationReviewItems.total,
                onPageChange: setRotationReviewPage,
              }}
              headerExtra={
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={rotationReviewScope.includeSubfolders}
                    onChange={(event) =>
                      setRotationReviewScope({
                        folderPath: rotationReviewScope.folderPath,
                        includeSubfolders: event.currentTarget.checked,
                      })
                    }
                  />
                  <span>Include subfolders</span>
                </label>
              }
              onOriginalImageClick={openRotationReviewItemInViewer}
              onBackToPhotos={() => {
                setRotationReviewScope(null);
                setMainPaneViewMode("media");
              }}
            />
          ) : (
            <ImageEditSuggestionsView
              hasFolderSelected={Boolean(selectedFolder)}
              items={imageEditSuggestionItems}
              onBackToPhotos={() => setMainPaneViewMode("media")}
            />
          )
        ) : mainPaneViewMode === "folderAiSummary" && selectedFolder ? (
          <DesktopFolderAiSummaryView
            folderPath={selectedFolder}
            onBackToPhotos={() => setMainPaneViewMode("media")}
            onRunSemanticPipeline={(folderPath, recursive, overrideExisting) =>
              pipeline.handleIndexSemantic(folderPath, recursive, overrideExisting)
            }
            onRunFacePipeline={(folderPath, recursive, overrideExisting) =>
              pipeline.handleDetectFaces(folderPath, recursive, overrideExisting)
            }
            onRunPhotoPipeline={(folderPath, recursive, overrideExisting) =>
              pipeline.handleAnalyzePhotos(folderPath, recursive, overrideExisting)
            }
            onOpenFolderSummary={handleOpenFolderAiSummary}
            onOpenRotationReview={onOpenRotationReview}
          />
        ) : (
          <>
            {selectedFolder && mediaItemsLength === 0 && !isFolderLoading && (
              <div className={MEDIA_PANE_EMPTY_STATE_CLASS}>
                <div>{UI_TEXT.noPhotos}</div>
                {showEmptyFolderSummaryCta ? (
                  <button
                    type="button"
                    className="mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-md border border-primary bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-95"
                    onClick={() => handleOpenFolderAiSummary(selectedFolder)}
                  >
                    <BarChart3 size={17} aria-hidden="true" />
                    <span>{UI_TEXT.folderAiSummaryTreeActionCta}</span>
                  </button>
                ) : null}
              </div>
            )}
            {selectedFolder &&
              mediaItemsLength > 0 &&
              filteredMediaItems.length === 0 &&
              !isFolderLoading &&
              !semanticModeActive && (
              <div className={MEDIA_PANE_EMPTY_STATE_CLASS}>{UI_TEXT.noPhotosForFilters}</div>
            )}
            {!selectedFolder ? <div className={MEDIA_PANE_EMPTY_STATE_CLASS}>{UI_TEXT.noFolder}</div> : null}
            {isFolderLoading && (
              <div className="mx-4 my-3 inline-flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-muted-foreground">
                <div
                  className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-[#79d7a4]"
                  aria-hidden
                />
                <span>
                  {folderLoadProgress.total !== null
                    ? `${UI_TEXT.loadingFolder} ${folderLoadProgress.loaded}/${folderLoadProgress.total}`
                    : `${UI_TEXT.loadingFolder} ${folderLoadProgress.loaded}`}
                </span>
              </div>
            )}
            {filteredMediaItems.length > 0 && viewMode === "grid" && !semanticModeActive ? (
              <div data-testid="desktop-folder-thumbnails-grid" className="min-h-0 min-w-0 flex-1">
                <MediaThumbnailGrid
                  items={filteredMediaItems.map((image) => ({
                    id: image.id,
                    title: image.title,
                    imageUrl: image.imageUrl,
                    subtitle: image.subtitle,
                    starRating: image.starRating,
                    onStarRatingChange: onStarRatingChangeForPath(image.id),
                    starRatingShowRejected: STAR_RATING_SHOW_REJECTED_UI,
                    mediaType: image.mediaType,
                  }))}
                  onItemClick={(index) => {
                    const item = filteredMediaItems[index];
                    if (item) openFilteredItemInViewer(item.id);
                  }}
                  showActionsMenu={false}
                  renderActions={(item) => (
                    <DesktopMediaItemActionsMenu filePath={item.id} mediaType={item.mediaType} />
                  )}
                  priorityCount={24}
                  scrollable={false}
                />
              </div>
            ) : null}
            {semanticModeActive && viewMode === "grid" && filteredDisplaySemanticResults.length > 0 ? (
              <div data-testid="desktop-search-results-grid" className="min-h-0 min-w-0 flex-1">
                <MediaThumbnailGrid
                  items={filteredDisplaySemanticResults.map((image) => {
                    const meta = lookupMediaMetadataByItemId<DesktopMediaItemMetadata>(
                      image.id,
                      mediaMetadataByItemId,
                    );
                    return {
                      id: image.id,
                      title: image.title,
                      imageUrl: image.imageUrl,
                      subtitle: image.subtitle,
                      starRating: typeof meta?.starRating === "number" ? meta.starRating : null,
                      onStarRatingChange: onStarRatingChangeForPath(image.id),
                      starRatingShowRejected: STAR_RATING_SHOW_REJECTED_UI,
                      mediaType: meta?.mediaKind === "video" ? "video" : "image",
                    };
                  })}
                  onItemClick={(index) => store.getState().openViewer(index, "search")}
                  showActionsMenu={false}
                  renderActions={(item) => <DesktopMediaItemActionsMenu filePath={item.id} />}
                  priorityCount={24}
                  scrollable={false}
                />
              </div>
            ) : null}
            {semanticResults.length > 0 && displaySemanticResults.length === 0 && (
              <div className={MEDIA_PANE_EMPTY_STATE_CLASS}>
                <div className="text-lg font-semibold">{UI_TEXT.semanticSearchNoResultsTitle}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {UI_TEXT.semanticSearchNoResultsAboveThreshold}
                </div>
              </div>
            )}
            {semanticResults.length > 0 &&
              displaySemanticResults.length > 0 &&
              filteredDisplaySemanticResults.length === 0 &&
              quickFiltersActiveCount > 0 && (
                <div className={MEDIA_PANE_EMPTY_STATE_CLASS}>{UI_TEXT.noPhotosForFilters}</div>
              )}
            {filteredMediaItems.length > 0 && viewMode === "list" && !semanticModeActive ? (
              <div className="grid grid-cols-1 gap-2 overflow-visible p-4 lg:grid-cols-2 lg:gap-3">
                {filteredMediaItems.map((image) => (
                  <DesktopMediaItemListRow
                    key={image.id}
                    title={image.title}
                    onRowClick={() => openFilteredItemInViewer(image.id)}
                    metadataLine={image.photoTakenDisplay}
                    filePath={image.id}
                    mediaType={image.mediaType}
                    starRating={image.starRating}
                    onStarRatingChange={onStarRatingChangeForPath(image.id)}
                    starRatingShowRejected={STAR_RATING_SHOW_REJECTED_UI}
                    thumbnail={renderListThumbnail(image.imageUrl, image.title, image.mediaType)}
                  />
                ))}
              </div>
            ) : null}
            {semanticModeActive && viewMode === "list" && filteredSemanticListItems.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 overflow-visible p-4 lg:grid-cols-2 lg:gap-3">
                {filteredSemanticListItems.map((image, index) => {
                  const meta = lookupMediaMetadataByItemId<DesktopMediaItemMetadata>(
                    image.id,
                    mediaMetadataByItemId,
                  );
                  const rowMediaType = meta?.mediaKind === "video" ? "video" : "image";
                  return (
                    <DesktopMediaItemListRow
                      key={image.id}
                      title={image.title}
                      onRowClick={() => store.getState().openViewer(index, "search")}
                      metadataLine={image.photoTakenDisplay}
                      folderLine={image.subtitle}
                      extraLines={[
                        `${UI_TEXT.semanticListVlmScoreLabel} ${formatSemanticCosinePercent(image.vlmSimilarity)}`,
                        `${UI_TEXT.semanticListDescriptionScoreLabel} ${formatSemanticCosinePercent(image.descriptionSimilarity)}`,
                      ]}
                      filePath={image.id}
                      mediaType={rowMediaType}
                      starRating={image.starRating}
                      onStarRatingChange={onStarRatingChangeForPath(image.id)}
                      starRatingShowRejected={STAR_RATING_SHOW_REJECTED_UI}
                      thumbnail={renderListThumbnail(image.imageUrl, image.title, rowMediaType)}
                    />
                  );
                })}
              </div>
            ) : null}
          </>
        )}
      </div>
      )}
    </div>
  );
}

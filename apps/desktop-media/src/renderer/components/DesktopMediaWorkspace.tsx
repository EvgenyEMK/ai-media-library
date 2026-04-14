import { useCallback, type ReactElement, type Dispatch, type SetStateAction } from "react";
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
import { DesktopMetadataScanFollowUpBanner } from "./DesktopMetadataScanFollowUpBanner";
import { SemanticSearchPanel } from "./SemanticSearchPanel";
import type { DesktopPipelineHandlers } from "../hooks/use-desktop-pipeline-handlers";
import { useMediaItemStarRatingChange } from "../hooks/use-media-item-star-rating-change";
import { MEDIA_PANE_EMPTY_STATE_CLASS } from "../lib/media-pane-ui";
import { lookupMediaMetadataByItemId } from "../lib/media-metadata-lookup";
import { UI_TEXT } from "../lib/ui-text";
import type { DesktopMediaItemMetadata } from "../../shared/ipc";
import { useDesktopStore, type DesktopStore, type DesktopStoreState } from "../stores/desktop-store";
import type { MainPaneViewMode } from "../types/app-types";

/** Future: surface Adobe-style rejected (-1) in grid/list; kept off until pick/reject UX ships. */
const STAR_RATING_SHOW_REJECTED_UI = false;

interface DesktopMediaWorkspaceProps {
  store: DesktopStore;
  mainPaneViewMode: MainPaneViewMode;
  setMainPaneViewMode: Dispatch<SetStateAction<MainPaneViewMode>>;
  selectedFolder: string | null;
  semanticPanelOpen: boolean;
  metadataScanFollowUp: DesktopStoreState["metadataScanFollowUp"];
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
  selectedFolder,
  semanticPanelOpen,
  metadataScanFollowUp,
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
  openFolderViewerById,
}: DesktopMediaWorkspaceProps): ReactElement {
  const mediaMetadataByItemId = useDesktopStore((s) => s.mediaMetadataByItemId);
  const commitStarRating = useMediaItemStarRatingChange();
  const onStarRatingChangeForPath = useCallback(
    (path: string) => (next: number) => {
      void commitStarRating(path, next);
    },
    [commitStarRating],
  );

  return (
    <>
      {metadataScanFollowUp ? (
        <DesktopMetadataScanFollowUpBanner
          scanRootFolderPath={metadataScanFollowUp.scanRootFolderPath}
          filesNeedingAiPipelineFollowUp={metadataScanFollowUp.filesNeedingAiPipelineFollowUp}
          foldersNeedingAiFollowUpCount={metadataScanFollowUp.foldersNeedingAiFollowUpCount}
          onRunPhotoMissing={() => {
            const root = store.getState().metadataScanFollowUp?.scanRootFolderPath;
            if (root) void pipeline.handleAnalyzePhotos(root, true, false);
            store.getState().clearMetadataScanFollowUp();
          }}
          onRunFaceMissing={() => {
            const root = store.getState().metadataScanFollowUp?.scanRootFolderPath;
            if (root) void pipeline.handleDetectFaces(root, true, false);
            store.getState().clearMetadataScanFollowUp();
          }}
          onRunSemanticMissing={() => {
            const root = store.getState().metadataScanFollowUp?.scanRootFolderPath;
            if (root) void pipeline.handleIndexSemantic(root, true, false);
            store.getState().clearMetadataScanFollowUp();
          }}
          onDismiss={() => store.getState().clearMetadataScanFollowUp()}
        />
      ) : null}
      {faceModelDownload.visible && faceModelDownload.status === "running" ? (
        <DesktopFaceModelDownloadBanner
          message={faceModelDownload.message || "Downloading AI face detection and recognition models..."}
          filename={faceModelDownload.filename}
          percent={faceModelDownload.percent}
          downloadedBytes={faceModelDownload.downloadedBytes}
          totalBytes={faceModelDownload.totalBytes}
        />
      ) : null}

      {mainPaneViewMode === "media" && semanticPanelOpen ? (
        <SemanticSearchPanel onSearch={() => void pipeline.handleSemanticSearch()} />
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {mainPaneViewMode === "imageEditSuggestions" ? (
          <ImageEditSuggestionsView
            hasFolderSelected={Boolean(selectedFolder)}
            items={imageEditSuggestionItems}
            onBackToPhotos={() => setMainPaneViewMode("media")}
          />
        ) : mainPaneViewMode === "folderAiSummary" && selectedFolder ? (
          <DesktopFolderAiSummaryView
            folderPath={selectedFolder}
            onBackToPhotos={() => setMainPaneViewMode("media")}
            onOpenFolderSummary={handleOpenFolderAiSummary}
          />
        ) : (
          <>
            {selectedFolder && mediaItemsLength === 0 && !isFolderLoading && (
              <div className={MEDIA_PANE_EMPTY_STATE_CLASS}>{UI_TEXT.noPhotos}</div>
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
                  }))}
                  onItemClick={(index) => {
                    const item = filteredMediaItems[index];
                    if (item) openFolderViewerById(item.id);
                  }}
                  showActionsMenu={false}
                  renderActions={(item) => <DesktopMediaItemActionsMenu filePath={item.id} />}
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
              <div className={MEDIA_PANE_EMPTY_STATE_CLASS}>{UI_TEXT.semanticSearchNoResultsAboveThreshold}</div>
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
                    onRowClick={() => openFolderViewerById(image.id)}
                    metadataLine={image.photoTakenDisplay}
                    filePath={image.id}
                    starRating={image.starRating}
                    onStarRatingChange={onStarRatingChangeForPath(image.id)}
                    starRatingShowRejected={STAR_RATING_SHOW_REJECTED_UI}
                    thumbnail={
                      image.imageUrl ? (
                        <img
                          className="h-36 w-36 shrink-0 rounded object-cover"
                          src={image.imageUrl}
                          alt={image.title}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded bg-muted text-center text-xs text-muted-foreground">
                          Preview unavailable
                        </div>
                      )
                    }
                  />
                ))}
              </div>
            ) : null}
            {semanticModeActive && viewMode === "list" && filteredSemanticListItems.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 overflow-visible p-4 lg:grid-cols-2 lg:gap-3">
                {filteredSemanticListItems.map((image, index) => (
                  <DesktopMediaItemListRow
                    key={image.id}
                    title={image.title}
                    onRowClick={() => store.getState().openViewer(index, "search")}
                    metadataLine={image.photoTakenDisplay}
                    folderLine={image.subtitle}
                    filePath={image.id}
                    starRating={image.starRating}
                    onStarRatingChange={onStarRatingChangeForPath(image.id)}
                    starRatingShowRejected={STAR_RATING_SHOW_REJECTED_UI}
                    thumbnail={
                      image.imageUrl ? (
                        <img
                          className="h-36 w-36 shrink-0 rounded object-cover"
                          src={image.imageUrl}
                          alt={image.title}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded bg-muted text-center text-xs text-muted-foreground">
                          Preview unavailable
                        </div>
                      )
                    }
                  />
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

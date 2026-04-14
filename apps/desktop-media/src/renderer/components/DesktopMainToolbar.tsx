import type { Dispatch, ReactElement, RefObject, SetStateAction } from "react";
import { Filter, Grid3X3, List, MoreVertical, Search } from "lucide-react";
import type { ThumbnailQuickFilterState } from "@emk/media-metadata-core";
import { DesktopActionsMenu } from "./DesktopActionsMenu";
import { DesktopFolderAiPipelineStrip } from "./DesktopFolderAiPipelineStrip";
import { QuickFiltersMenu } from "./QuickFiltersMenu";
import { ToolbarIconButton } from "./ToolbarIconButton";
import type { DesktopPipelineHandlers } from "../hooks/use-desktop-pipeline-handlers";
import { UI_TEXT } from "../lib/ui-text";
import type { MainPaneViewMode } from "../types/app-types";
import type { DesktopStore, DesktopStoreState } from "../stores/desktop-store";

interface DesktopMainToolbarProps {
  store: DesktopStore;
  selectedFolderLabel: string;
  quickFiltersActiveCount: number;
  mediaItemsLength: number;
  filteredMediaItemsLength: number;
  semanticModeActive: boolean;
  /** Count after similarity gate (denominator for search-mode filter summary). */
  displaySemanticResultsCount: number;
  filteredDisplaySemanticResultsCount: number;
  selectedFolder: string | null;
  aiPipelineStripRefreshKey: string;
  semanticPanelOpen: boolean;
  quickFiltersMenuOpen: boolean;
  setQuickFiltersMenuOpen: Dispatch<SetStateAction<boolean>>;
  quickFiltersMenuWrapRef: RefObject<HTMLDivElement | null>;
  quickFilters: ThumbnailQuickFilterState;
  setQuickFilters: Dispatch<SetStateAction<ThumbnailQuickFilterState>>;
  viewMode: DesktopStoreState["viewMode"];
  actionsMenuOpen: boolean;
  setActionsMenuOpen: Dispatch<SetStateAction<boolean>>;
  actionsMenuWrapRef: RefObject<HTMLDivElement | null>;
  setMainPaneViewMode: Dispatch<SetStateAction<MainPaneViewMode>>;
  pipeline: DesktopPipelineHandlers;
  descEmbedBackfillRunning: boolean;
}

export function DesktopMainToolbar({
  store,
  selectedFolderLabel,
  quickFiltersActiveCount,
  mediaItemsLength,
  filteredMediaItemsLength,
  semanticModeActive,
  displaySemanticResultsCount,
  filteredDisplaySemanticResultsCount,
  selectedFolder,
  aiPipelineStripRefreshKey,
  semanticPanelOpen,
  quickFiltersMenuOpen,
  setQuickFiltersMenuOpen,
  quickFiltersMenuWrapRef,
  quickFilters,
  setQuickFilters,
  viewMode,
  actionsMenuOpen,
  setActionsMenuOpen,
  actionsMenuWrapRef,
  setMainPaneViewMode,
  pipeline,
  descEmbedBackfillRunning,
}: DesktopMainToolbarProps): ReactElement {
  return (
    <header className="panel-header flex items-start justify-between gap-3 border-b border-border px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden text-[13px] text-muted-foreground">
          <span className="min-w-0 truncate">{selectedFolderLabel}</span>
          {quickFiltersActiveCount > 0 &&
          (semanticModeActive
            ? displaySemanticResultsCount > 0
            : mediaItemsLength > 0) ? (
            <span className="shrink-0 text-xs text-[#8ea3ce]">
              {semanticModeActive
                ? `${UI_TEXT.filterSummaryPrefix}: ${filteredDisplaySemanticResultsCount}/${displaySemanticResultsCount}`
                : `${UI_TEXT.filterSummaryPrefix}: ${filteredMediaItemsLength}/${mediaItemsLength}`}
            </span>
          ) : null}
        </div>
        <DesktopFolderAiPipelineStrip folderPath={selectedFolder} refreshKey={aiPipelineStripRefreshKey} />
      </div>
      <div className="relative flex gap-2">
        <ToolbarIconButton
          title={UI_TEXT.semanticOpen}
          ariaExpanded={semanticPanelOpen}
          onClick={() => store.getState().toggleSemanticPanel()}
        >
          <Search size={16} aria-hidden="true" />
        </ToolbarIconButton>
        <div className="relative" ref={quickFiltersMenuWrapRef}>
          <ToolbarIconButton
            dataTestId="desktop-quick-filters-trigger"
            title={quickFiltersMenuOpen ? UI_TEXT.filterMenuClose : UI_TEXT.filterMenuOpen}
            ariaExpanded={quickFiltersMenuOpen}
            ariaPressed={quickFiltersActiveCount > 0}
            isActive={quickFiltersActiveCount > 0}
            badgeCount={quickFiltersActiveCount}
            onClick={() =>
              setQuickFiltersMenuOpen((value) => {
                const next = !value;
                if (next) setActionsMenuOpen(false);
                return next;
              })
            }
          >
            <Filter size={16} aria-hidden="true" />
          </ToolbarIconButton>
          <QuickFiltersMenu isOpen={quickFiltersMenuOpen} filters={quickFilters} onFiltersChange={setQuickFilters} />
        </div>
        <ToolbarIconButton
          title={UI_TEXT.gridView}
          ariaPressed={viewMode === "grid"}
          isActive={viewMode === "grid"}
          onClick={() => store.getState().setViewMode("grid")}
        >
          <Grid3X3 size={16} aria-hidden="true" />
        </ToolbarIconButton>
        <ToolbarIconButton
          title={UI_TEXT.listView}
          ariaPressed={viewMode === "list"}
          isActive={viewMode === "list"}
          onClick={() => store.getState().setViewMode("list")}
        >
          <List size={16} aria-hidden="true" />
        </ToolbarIconButton>
        <div className="relative" ref={actionsMenuWrapRef}>
          <ToolbarIconButton
            title={UI_TEXT.albumActions}
            ariaLabel="More actions"
            isActive={actionsMenuOpen}
            onClick={() =>
              setActionsMenuOpen((v) => {
                const next = !v;
                if (next) setQuickFiltersMenuOpen(false);
                return next;
              })
            }
          >
            <MoreVertical size={16} aria-hidden="true" />
          </ToolbarIconButton>
          {actionsMenuOpen ? (
            <DesktopActionsMenu
              onSetMainPaneViewMode={setMainPaneViewMode}
              onAnalyzePhotos={(folderPath, recursive, overrideExisting) =>
                void pipeline.handleAnalyzePhotos(folderPath, recursive, overrideExisting)
              }
              onCancelAnalysis={pipeline.handleCancelAnalysis}
              onDetectFaces={(folderPath, recursive, overrideExisting) =>
                void pipeline.handleDetectFaces(folderPath, recursive, overrideExisting)
              }
              onCancelFaceDetection={pipeline.handleCancelFaceDetection}
              onIndexSemantic={(folderPath, recursive, overrideExisting) =>
                void pipeline.handleIndexSemantic(folderPath, recursive, overrideExisting)
              }
              onCancelSemanticIndex={() => void pipeline.handleCancelSemanticIndex()}
              onCloseMenu={() => setActionsMenuOpen(false)}
              onIndexDescEmbeddings={(folderPath, recursive) =>
                void pipeline.handleIndexDescEmbeddings(folderPath, recursive)
              }
              onCancelDescEmbedBackfill={() => void pipeline.handleCancelDescEmbedBackfill()}
              descEmbedBackfillRunning={descEmbedBackfillRunning}
              onAnalyzeFolderPathMetadata={(folderPath, recursive) =>
                void pipeline.handleAnalyzeFolderPathMetadata(folderPath, recursive)
              }
              onCancelPathAnalysis={() => void pipeline.handleCancelPathAnalysis()}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}

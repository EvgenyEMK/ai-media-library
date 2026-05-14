import type { ReactElement } from "react";
import { MainAppSidebar } from "@emk/media-viewer";
import type { SmartAlbumRootKind } from "@emk/shared-contracts";
import { FileText, FolderOpen, Images, Lightbulb, PanelLeftClose, PanelLeftOpen, Plus, Settings, Users } from "lucide-react";
import { DesktopFoldersSidebarPanel } from "./DesktopFoldersSidebarPanel";
import { DesktopSidebarAlbumsSection } from "./DesktopSidebarAlbumsSection";
import { DesktopSidebarDocumentsSection } from "./documents/desktop-sidebar-documents-section";
import { DesktopSidebarInsightsSection } from "./insights/desktop-sidebar-insights-section";
import type { DesktopPipelineHandlers } from "../hooks/use-desktop-pipeline-handlers";
import { UI_TEXT } from "../lib/ui-text";
import { cn } from "../lib/cn";
import { resolveMainAppSidebarActiveSectionId } from "../lib/main-app-sidebar-active-section-id";
import type { DesktopStore, DesktopStoreState } from "../stores/desktop-store";
import type {
  DocumentsSidebarSubSection,
  ExpandedSidebarSectionId,
  InsightsSidebarSubSection,
  PrimarySidebarSectionId,
} from "../types/app-types";

interface DesktopAppSidebarProps {
  store: DesktopStore;
  sidebarCollapsed: boolean;
  primarySidebarSection: PrimarySidebarSectionId;
  /** When set, Documents/Insights headers stay visually inactive in expanded sidebar (sub-row shows active); in collapsed sidebar the parent icon is active instead. */
  insightsSubSection: InsightsSidebarSubSection | null;
  documentsSubSection: DocumentsSidebarSubSection | null;
  expandedSidebarSection: ExpandedSidebarSectionId | null;
  onSectionToggle: (sectionId: string) => void;
  libraryRoots: DesktopStoreState["libraryRoots"];
  selectedFolder: DesktopStoreState["selectedFolder"];
  expandedFolders: DesktopStoreState["expandedFolders"];
  childrenByPath: DesktopStoreState["childrenByPath"];
  folderAnalysisByPath: DesktopStoreState["folderAnalysisByPath"];
  folderRollupByPath: DesktopStoreState["folderRollupByPath"];
  pipeline: DesktopPipelineHandlers;
  onCreateAlbum: () => void;
  onAlbumSelected: () => void;
  onSmartAlbumSelected: (kind: SmartAlbumRootKind) => void;
  onShowAlbumList: () => void;
  onOpenInsightsDuplicateFiles: () => void;
  onOpenInsightsFolderAnalysis: () => void;
  onOpenInvoicesReceipts: () => void;
  insightsDuplicateFilesActive: boolean;
  insightsFolderAnalysisActive: boolean;
  invoicesReceiptsActive: boolean;
  /** When albums workspace is in smart mode, which root is active (sidebar row highlight). */
  sidebarHighlightedSmartAlbumKind: SmartAlbumRootKind | null;
  /** When set, overrides default RECENT expansion in the albums sidebar (e.g. from app settings). */
  albumsSidebarExpandRecentByDefault?: boolean;
  folderTree: {
    handleAddLibrary: () => Promise<void>;
    handleToggleExpand: (folderPath: string) => Promise<void>;
    handleSelectFolder: (folderPath: string) => Promise<void>;
    handleRemoveLibrary: (rootPath: string) => void;
    handleOpenFolderAiSummary: (folderPath: string) => void;
    handleCheckDuplicateFiles?: (folderPath: string, recursive: boolean) => void;
  };
}

export function DesktopAppSidebar({
  store,
  sidebarCollapsed,
  primarySidebarSection,
  insightsSubSection,
  documentsSubSection,
  expandedSidebarSection,
  onSectionToggle,
  libraryRoots,
  selectedFolder,
  expandedFolders,
  childrenByPath,
  folderAnalysisByPath,
  folderRollupByPath,
  pipeline,
  onCreateAlbum,
  onAlbumSelected,
  onSmartAlbumSelected,
  onShowAlbumList,
  onOpenInsightsDuplicateFiles,
  onOpenInsightsFolderAnalysis,
  onOpenInvoicesReceipts,
  insightsDuplicateFilesActive,
  insightsFolderAnalysisActive,
  invoicesReceiptsActive,
  sidebarHighlightedSmartAlbumKind,
  albumsSidebarExpandRecentByDefault,
  folderTree,
}: DesktopAppSidebarProps): ReactElement {
  return (
    <aside
      className={cn(
        "overflow-auto border-r border-border bg-card p-3",
        sidebarCollapsed && "w-[84px]",
      )}
    >
      <MainAppSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => store.getState().toggleSidebarCollapsed()}
        expandLabel={UI_TEXT.expand}
        collapseLabel={UI_TEXT.collapse}
        expandIcon={<PanelLeftOpen size={24} aria-hidden="true" />}
        collapseIcon={<PanelLeftClose size={24} aria-hidden="true" />}
        sections={[
          {
            id: "folders",
            label: UI_TEXT.sectionFolders,
            icon: <FolderOpen size={20} aria-hidden="true" />,
            headerTrailing:
              primarySidebarSection === "folders" &&
              insightsSubSection === null &&
              documentsSubSection === null &&
              libraryRoots.length > 0 ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void folderTree.handleAddLibrary();
                  }}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center border-0 border-transparent bg-transparent px-0 text-inherit shadow-none outline-none hover:bg-muted/70"
                  aria-label={UI_TEXT.addLibrary}
                  title={UI_TEXT.addLibrary}
                >
                  <Plus size={20} aria-hidden="true" />
                </button>
              ) : undefined,
            contentClassName: "pr-0",
            content: (
              <DesktopFoldersSidebarPanel
                libraryRoots={libraryRoots}
                selectedFolder={selectedFolder}
                expandedFolders={expandedFolders}
                childrenByPath={childrenByPath}
                folderAnalysisByPath={folderAnalysisByPath}
                folderRollupByPath={folderRollupByPath}
                pipeline={pipeline}
                handleAddLibrary={folderTree.handleAddLibrary}
                handleToggleExpand={folderTree.handleToggleExpand}
                handleSelectFolder={folderTree.handleSelectFolder}
                handleRemoveLibrary={folderTree.handleRemoveLibrary}
                handleOpenFolderAiSummary={folderTree.handleOpenFolderAiSummary}
                handleCheckDuplicateFiles={folderTree.handleCheckDuplicateFiles}
              />
            ),
          },
          {
            id: "albums",
            label: UI_TEXT.sectionAlbums,
            icon: <Images size={20} aria-hidden="true" />,
            headerTrailing: primarySidebarSection === "albums" && insightsSubSection === null && documentsSubSection === null
              ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCreateAlbum();
                    }}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center border-0 bg-transparent px-0 text-inherit shadow-none outline-none hover:bg-muted/70"
                    aria-label="Create album"
                    title="Create album"
                  >
                    <Plus size={20} aria-hidden="true" />
                  </button>
                )
              : undefined,
            contentChrome: "plain",
            contentClassName: "pr-0",
            content: (
              <DesktopSidebarAlbumsSection
                collapsed={false}
                expandRecentAlbumsByDefault={albumsSidebarExpandRecentByDefault}
                onAlbumSelected={onAlbumSelected}
                onSmartAlbumSelected={onSmartAlbumSelected}
                onShowAlbumList={onShowAlbumList}
                highlightedSmartAlbumKind={sidebarHighlightedSmartAlbumKind}
              />
            ),
          },
          {
            id: "people",
            label: UI_TEXT.sectionPeople,
            icon: <Users size={20} aria-hidden="true" />,
          },
          {
            id: "documents",
            label: UI_TEXT.sectionDocuments,
            icon: <FileText size={20} aria-hidden="true" />,
            contentChrome: "plain",
            contentClassName: "pr-0",
            content: (
              <DesktopSidebarDocumentsSection
                isInvoicesReceiptsActive={invoicesReceiptsActive}
                onOpenInvoicesReceipts={onOpenInvoicesReceipts}
              />
            ),
          },
          {
            id: "insights",
            label: UI_TEXT.sectionInsights,
            icon: <Lightbulb size={20} aria-hidden="true" />,
            contentChrome: "plain",
            contentClassName: "pr-0",
            content: (
              <DesktopSidebarInsightsSection
                isDuplicateFilesActive={insightsDuplicateFilesActive}
                isFolderAnalysisActive={insightsFolderAnalysisActive}
                onOpenDuplicateFiles={onOpenInsightsDuplicateFiles}
                onOpenFolderAnalysis={onOpenInsightsFolderAnalysis}
              />
            ),
          },
        ]}
        bottomSections={[
          {
            id: "settings",
            label: UI_TEXT.sectionSettings,
            icon: <Settings size={20} aria-hidden="true" />,
          },
        ]}
        activeSectionId={resolveMainAppSidebarActiveSectionId({
          sidebarCollapsed,
          primarySidebarSection,
          documentsSubSection,
          insightsSubSection,
        })}
        expandedSectionId={expandedSidebarSection}
        onSectionToggle={onSectionToggle}
      />
    </aside>
  );
}

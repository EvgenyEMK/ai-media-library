import type { ReactElement } from "react";
import { MainAppSidebar } from "@emk/media-viewer";
import { FolderOpen, Images, PanelLeftClose, PanelLeftOpen, Settings, Users } from "lucide-react";
import { DesktopFoldersSidebarPanel } from "./DesktopFoldersSidebarPanel";
import { DesktopSidebarAlbumsSection } from "./DesktopSidebarAlbumsSection";
import type { DesktopPipelineHandlers } from "../hooks/use-desktop-pipeline-handlers";
import { UI_TEXT } from "../lib/ui-text";
import { cn } from "../lib/cn";
import type { DesktopStore, DesktopStoreState } from "../stores/desktop-store";
import type { SidebarSectionId } from "../types/app-types";

interface DesktopAppSidebarProps {
  store: DesktopStore;
  sidebarCollapsed: boolean;
  expandedSidebarSection: SidebarSectionId | null;
  onSectionToggle: (sectionId: string) => void;
  libraryRoots: DesktopStoreState["libraryRoots"];
  selectedFolder: DesktopStoreState["selectedFolder"];
  expandedFolders: DesktopStoreState["expandedFolders"];
  childrenByPath: DesktopStoreState["childrenByPath"];
  folderAnalysisByPath: DesktopStoreState["folderAnalysisByPath"];
  folderRollupByPath: DesktopStoreState["folderRollupByPath"];
  foldersWithCatalogChanges: DesktopStoreState["foldersWithCatalogChanges"];
  descEmbedBackfillRunning: boolean;
  pipeline: DesktopPipelineHandlers;
  folderTree: {
    handleAddLibrary: () => Promise<void>;
    handleToggleExpand: (folderPath: string) => Promise<void>;
    handleSelectFolder: (folderPath: string) => Promise<void>;
    handleRemoveLibrary: (rootPath: string) => void;
    handleOpenFolderAiSummary: (folderPath: string) => void;
  };
}

export function DesktopAppSidebar({
  store,
  sidebarCollapsed,
  expandedSidebarSection,
  onSectionToggle,
  libraryRoots,
  selectedFolder,
  expandedFolders,
  childrenByPath,
  folderAnalysisByPath,
  folderRollupByPath,
  foldersWithCatalogChanges,
  descEmbedBackfillRunning,
  pipeline,
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
            icon: <FolderOpen size={16} aria-hidden="true" />,
            content: (
              <DesktopFoldersSidebarPanel
                libraryRoots={libraryRoots}
                selectedFolder={selectedFolder}
                expandedFolders={expandedFolders}
                childrenByPath={childrenByPath}
                folderAnalysisByPath={folderAnalysisByPath}
                folderRollupByPath={folderRollupByPath}
                foldersWithCatalogChanges={foldersWithCatalogChanges}
                descEmbedBackfillRunning={descEmbedBackfillRunning}
                pipeline={pipeline}
                handleAddLibrary={folderTree.handleAddLibrary}
                handleToggleExpand={folderTree.handleToggleExpand}
                handleSelectFolder={folderTree.handleSelectFolder}
                handleRemoveLibrary={folderTree.handleRemoveLibrary}
                handleOpenFolderAiSummary={folderTree.handleOpenFolderAiSummary}
              />
            ),
          },
          {
            id: "albums",
            label: UI_TEXT.sectionAlbums,
            icon: <Images size={16} aria-hidden="true" />,
            content: <DesktopSidebarAlbumsSection collapsed={false} />,
          },
          {
            id: "people",
            label: UI_TEXT.sectionPeople,
            icon: <Users size={16} aria-hidden="true" />,
          },
        ]}
        bottomSections={[
          {
            id: "settings",
            label: UI_TEXT.sectionSettings,
            icon: <Settings size={16} aria-hidden="true" />,
          },
        ]}
        expandedSectionId={expandedSidebarSection}
        onSectionToggle={onSectionToggle}
      />
    </aside>
  );
}

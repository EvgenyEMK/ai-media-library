import type { ReactElement } from "react";
import { MainAppSidebar } from "@emk/media-viewer";
import { FolderOpen, Images, PanelLeftClose, PanelLeftOpen, Plus, Settings, Users } from "lucide-react";
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
  activeSidebarSection: SidebarSectionId;
  expandedSidebarSection: SidebarSectionId | null;
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
  onShowAlbumList: () => void;
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
  activeSidebarSection,
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
  onShowAlbumList,
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
            headerTrailing: activeSidebarSection === "folders"
              ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void folderTree.handleAddLibrary();
                    }}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center border-0 bg-transparent px-0 text-inherit shadow-none outline-none hover:bg-muted/70"
                    aria-label={UI_TEXT.addLibrary}
                    title={UI_TEXT.addLibrary}
                  >
                    <Plus size={20} aria-hidden="true" />
                  </button>
                )
              : undefined,
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
              />
            ),
          },
          {
            id: "albums",
            label: UI_TEXT.sectionAlbums,
            icon: <Images size={20} aria-hidden="true" />,
            headerTrailing: activeSidebarSection === "albums"
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
                onAlbumSelected={onAlbumSelected}
                onShowAlbumList={onShowAlbumList}
              />
            ),
          },
          {
            id: "people",
            label: UI_TEXT.sectionPeople,
            icon: <Users size={20} aria-hidden="true" />,
          },
        ]}
        bottomSections={[
          {
            id: "settings",
            label: UI_TEXT.sectionSettings,
            icon: <Settings size={20} aria-hidden="true" />,
          },
        ]}
        activeSectionId={activeSidebarSection}
        expandedSectionId={expandedSidebarSection}
        onSectionToggle={onSectionToggle}
      />
    </aside>
  );
}

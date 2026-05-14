import type { ReactElement } from "react";
import { Plus } from "lucide-react";
import { SidebarTree } from "./SidebarTree";
import type { DesktopPipelineHandlers } from "../hooks/use-desktop-pipeline-handlers";
import { UI_TEXT } from "../lib/ui-text";
import type { DesktopStoreState } from "../stores/desktop-store";

interface DesktopFoldersSidebarPanelProps {
  libraryRoots: DesktopStoreState["libraryRoots"];
  selectedFolder: DesktopStoreState["selectedFolder"];
  expandedFolders: DesktopStoreState["expandedFolders"];
  childrenByPath: DesktopStoreState["childrenByPath"];
  folderAnalysisByPath: DesktopStoreState["folderAnalysisByPath"];
  folderRollupByPath: DesktopStoreState["folderRollupByPath"];
  pipeline: DesktopPipelineHandlers;
  handleAddLibrary: () => Promise<void>;
  handleToggleExpand: (folderPath: string) => Promise<void>;
  handleSelectFolder: (folderPath: string) => Promise<void>;
  handleRemoveLibrary: (rootPath: string) => void;
  handleOpenFolderAiSummary: (folderPath: string) => void;
  handleCheckDuplicateFiles?: (folderPath: string, recursive: boolean) => void;
}

export function DesktopFoldersSidebarPanel({
  libraryRoots,
  selectedFolder,
  expandedFolders,
  childrenByPath,
  folderAnalysisByPath,
  folderRollupByPath,
  pipeline,
  handleAddLibrary,
  handleToggleExpand,
  handleSelectFolder,
  handleRemoveLibrary,
  handleOpenFolderAiSummary,
  handleCheckDuplicateFiles,
}: DesktopFoldersSidebarPanelProps): ReactElement {
  return (
    <div className="space-y-2">
      <SidebarTree
        roots={libraryRoots}
        selectedFolder={selectedFolder}
        expanded={expandedFolders}
        childrenByPath={childrenByPath}
        folderAnalysisByPath={folderAnalysisByPath}
        folderRollupByPath={folderRollupByPath}
        collapsed={false}
        onToggleExpand={handleToggleExpand}
        onSelectFolder={handleSelectFolder}
        onRemoveLibrary={handleRemoveLibrary}
        onScanForFileChanges={(folderPath, recursive) =>
          void pipeline.handleScanForFileChanges(folderPath, recursive)
        }
        onCancelMetadataScan={() => void pipeline.handleCancelMetadataScan()}
        onAnalyzePhotos={(folderPath, recursive, overrideExisting) =>
          void pipeline.handleAnalyzePhotos(folderPath, recursive, overrideExisting)
        }
        onCancelAnalysis={() => void pipeline.handleCancelAnalysis()}
        onDetectFaces={(folderPath, recursive, overrideExisting) =>
          void pipeline.handleDetectFaces(folderPath, recursive, overrideExisting)
        }
        onCancelFaceDetection={() => void pipeline.handleCancelFaceDetection()}
        onIndexSemantic={(folderPath, recursive, overrideExisting) =>
          void pipeline.handleIndexSemantic(folderPath, recursive, overrideExisting)
        }
        onCancelSemanticIndex={() => void pipeline.handleCancelSemanticIndex()}
        onOpenFolderAiSummary={handleOpenFolderAiSummary}
        onAnalyzeFolderPathMetadata={(folderPath, recursive) =>
          void pipeline.handleAnalyzeFolderPathMetadata(folderPath, recursive)
        }
        onCancelPathAnalysis={() => void pipeline.handleCancelPathAnalysis()}
        onCheckDuplicateFiles={
          handleCheckDuplicateFiles
            ? (folderPath, recursive) => {
                handleCheckDuplicateFiles(folderPath, recursive);
              }
            : undefined
        }
      />
      {libraryRoots.length === 0 ? (
        <button
          type="button"
          onClick={() => void handleAddLibrary()}
          className="inline-flex h-9 w-full items-center justify-start rounded-md border-2 border-amber-600 bg-amber-500/5 px-2 text-sm text-foreground hover:bg-amber-500/10 dark:border-amber-500"
        >
          <Plus size={16} aria-hidden="true" className="mr-2" />
          {UI_TEXT.addLibrary}
        </button>
      ) : null}
    </div>
  );
}

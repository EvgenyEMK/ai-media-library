import type { ReactElement } from "react";
import { cn } from "../lib/cn";
import { UI_TEXT } from "../lib/ui-text";
import { useDesktopStore } from "../stores/desktop-store";
import { FolderAnalysisMenuSection } from "./FolderAnalysisMenuSection";
import type { MainPaneViewMode } from "../types/app-types";

interface DesktopActionsMenuProps {
  onSetMainPaneViewMode: (mode: MainPaneViewMode) => void;
  onAnalyzePhotos: (folderPath: string, recursive: boolean, overrideExisting: boolean) => void;
  onCancelAnalysis: () => void;
  onDetectFaces: (folderPath: string, recursive: boolean, overrideExisting: boolean) => void;
  onCancelFaceDetection: () => void;
  onIndexSemantic: (folderPath: string, recursive: boolean, overrideExisting: boolean) => void;
  onCancelSemanticIndex: () => void;
  onCloseMenu: () => void;
  onAnalyzeFolderPathMetadata?: (folderPath: string, recursive: boolean) => void;
  onCancelPathAnalysis?: () => void;
}

export function DesktopActionsMenu({
  onSetMainPaneViewMode,
  onAnalyzePhotos,
  onCancelAnalysis,
  onDetectFaces,
  onCancelFaceDetection,
  onIndexSemantic,
  onCancelSemanticIndex,
  onCloseMenu,
  onAnalyzeFolderPathMetadata,
  onCancelPathAnalysis,
}: DesktopActionsMenuProps): ReactElement {
  const selectedFolder = useDesktopStore((s) => s.selectedFolder);

  return (
    <div
      className={cn(
        "desktop-actions-menu absolute right-0 top-9 z-40 grid min-w-[260px] gap-1.5 rounded-lg border border-border bg-card p-2",
      )}
    >
      <div className="box-border flex min-h-[34px] w-full items-center px-2.5 py-2 text-left text-sm leading-snug">
        <button
          type="button"
          className="w-full cursor-pointer border-0 bg-transparent p-0 px-0.5 text-left font-inherit leading-snug text-inherit shadow-none"
          disabled={!selectedFolder}
          onClick={() => {
            onSetMainPaneViewMode("imageEditSuggestions");
            onCloseMenu();
          }}
        >
          {UI_TEXT.imageEditSuggestions}
        </button>
      </div>
      <FolderAnalysisMenuSection
        targetFolderPath={selectedFolder}
        onAnalyzePhotos={onAnalyzePhotos}
        onCancelAnalysis={onCancelAnalysis}
        onDetectFaces={onDetectFaces}
        onCancelFaceDetection={onCancelFaceDetection}
        onIndexSemantic={onIndexSemantic}
        onCancelSemanticIndex={onCancelSemanticIndex}
        onAnalyzeFolderPathMetadata={onAnalyzeFolderPathMetadata}
        onCancelPathAnalysis={onCancelPathAnalysis}
      />
    </div>
  );
}

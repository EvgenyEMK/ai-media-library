import { useState, type ReactElement } from "react";
import { ChevronRight, Loader, Pause, Play } from "lucide-react";
import { cn } from "../lib/cn";
import { UI_TEXT } from "../lib/ui-text";
import { useDesktopStore } from "../stores/desktop-store";

const submenuLabelClass =
  "flex min-h-8 items-center justify-between gap-2 text-[13px] leading-snug text-muted-foreground";
const submenuCheckboxClass = "h-4 w-4 min-w-0 cursor-pointer accent-indigo-500";
const playBtnClass =
  "inline-flex items-center gap-1 rounded-md border border-border bg-transparent px-1.5 py-1 text-muted-foreground shadow-none transition-colors duration-150 hover:border-indigo-500 hover:bg-[#1e2a40] disabled:cursor-not-allowed disabled:opacity-40";
const rowLabelBtnClass =
  "inline-flex flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 px-0.5 text-left font-inherit text-inherit shadow-none";

interface FolderAnalysisMenuSectionProps {
  targetFolderPath: string | null;
  onAnalyzePhotos: (folderPath: string, recursive: boolean, overrideExisting: boolean) => void;
  onCancelAnalysis: () => void;
  onDetectFaces: (folderPath: string, recursive: boolean, overrideExisting: boolean) => void;
  onCancelFaceDetection: () => void;
  onIndexSemantic: (folderPath: string, recursive: boolean, overrideExisting: boolean) => void;
  onCancelSemanticIndex: () => void;
  // TEMPORARY: description embedding backfill — remove after migration
  onIndexDescEmbeddings?: (folderPath: string, recursive: boolean) => void;
  onCancelDescEmbedBackfill?: () => void;
  descEmbedBackfillRunning?: boolean;
  onAnalyzeFolderPathMetadata?: (folderPath: string, recursive: boolean) => void;
  onCancelPathAnalysis?: () => void;
}

export function FolderAnalysisMenuSection({
  targetFolderPath,
  onAnalyzePhotos,
  onCancelAnalysis,
  onDetectFaces,
  onCancelFaceDetection,
  onIndexSemantic,
  onCancelSemanticIndex,
  // TEMPORARY: description embedding backfill — remove after migration
  onIndexDescEmbeddings,
  onCancelDescEmbedBackfill,
  descEmbedBackfillRunning = false,
  onAnalyzeFolderPathMetadata,
  onCancelPathAnalysis,
}: FolderAnalysisMenuSectionProps): ReactElement {
  const aiStatus = useDesktopStore((s) => s.aiStatus);
  const faceStatus = useDesktopStore((s) => s.faceStatus);
  const semanticIndexStatus = useDesktopStore((s) => s.semanticIndexStatus);
  const pathExtractionUseLlm = useDesktopStore((s) => s.pathExtractionSettings.useLlm);
  const pathAnalysisStatus = useDesktopStore((s) => s.pathAnalysisStatus);

  const [faceMenuOpen, setFaceMenuOpen] = useState(false);
  const [faceIncludeSubfolders, setFaceIncludeSubfolders] = useState(true);
  const [faceOverrideExisting, setFaceOverrideExisting] = useState(false);
  const [photoAiMenuOpen, setPhotoAiMenuOpen] = useState(false);
  const [aiIncludeSubfolders, setAiIncludeSubfolders] = useState(true);
  const [aiOverrideExisting, setAiOverrideExisting] = useState(false);
  const [semanticMenuOpen, setSemanticMenuOpen] = useState(false);
  const [semanticIncludeSubfolders, setSemanticIncludeSubfolders] = useState(true);
  const [semanticOverrideExisting, setSemanticOverrideExisting] = useState(false);
  const [pathMenuOpen, setPathMenuOpen] = useState(false);
  const [pathIncludeSubfolders, setPathIncludeSubfolders] = useState(true);

  const isAnalyzing = aiStatus === "running";
  const isDetectingFaces = faceStatus === "running";
  const isSemanticIndexing = semanticIndexStatus === "running";
  const isPathAnalysisRunning = pathAnalysisStatus === "running";
  const hasTargetFolder = Boolean(targetFolderPath);

  return (
    <>
      <div className="box-border flex min-h-[34px] w-full items-center justify-between gap-2 py-2 pl-2.5 pr-0 text-left text-sm leading-snug">
        <button type="button" className={rowLabelBtnClass} onClick={() => setFaceMenuOpen((v) => !v)}>
          <ChevronRight
            size={14}
            className={cn(
              "shrink-0 transition-transform duration-150 ease-in-out",
              faceMenuOpen && "rotate-90",
            )}
            aria-hidden="true"
          />
          {UI_TEXT.faceDetection}
        </button>
        <button
          type="button"
          className={cn(playBtnClass, "face-detect-play-btn")}
          disabled={!hasTargetFolder}
          title={isDetectingFaces ? UI_TEXT.cancelFaceDetection : "Start face detection"}
          onClick={() => {
            if (isDetectingFaces) {
              onCancelFaceDetection();
            } else if (targetFolderPath) {
              onDetectFaces(targetFolderPath, faceIncludeSubfolders, faceOverrideExisting);
            }
          }}
        >
          {isDetectingFaces ? (
            <>
              <Loader size={14} className="animate-spin" aria-hidden="true" />
              <Pause size={14} aria-hidden="true" />
            </>
          ) : (
            <Play size={14} aria-hidden="true" />
          )}
        </button>
      </div>
      {faceMenuOpen ? (
        <div className="ml-3 grid gap-1.5 border-l border-border pl-3">
          <label className={submenuLabelClass}>
            <span>Include sub-folders</span>
            <input
              type="checkbox"
              className={submenuCheckboxClass}
              checked={faceIncludeSubfolders}
              disabled={isDetectingFaces}
              onChange={(e) => setFaceIncludeSubfolders(e.target.checked)}
            />
          </label>
          <label className={submenuLabelClass}>
            <span>Override existing</span>
            <input
              type="checkbox"
              className={submenuCheckboxClass}
              checked={faceOverrideExisting}
              disabled={isDetectingFaces}
              onChange={(e) => setFaceOverrideExisting(e.target.checked)}
            />
          </label>
        </div>
      ) : null}
      <div className="photo-ai-row box-border flex min-h-[34px] w-full items-center justify-between gap-2 py-2 pl-2.5 pr-0 text-left text-sm leading-snug">
        <button type="button" className={rowLabelBtnClass} onClick={() => setPhotoAiMenuOpen((v) => !v)}>
          <ChevronRight
            size={14}
            className={cn(
              "shrink-0 transition-transform duration-150 ease-in-out",
              photoAiMenuOpen && "rotate-90",
            )}
            aria-hidden="true"
          />
          {UI_TEXT.photoAIAnalysis}
        </button>
        <button
          type="button"
          className={cn(playBtnClass, "face-detect-play-btn")}
          disabled={!hasTargetFolder}
          title={isAnalyzing ? UI_TEXT.cancelPhotoAnalysis : "Start image AI analysis"}
          onClick={() => {
            if (isAnalyzing) {
              onCancelAnalysis();
            } else if (targetFolderPath) {
              onAnalyzePhotos(targetFolderPath, aiIncludeSubfolders, aiOverrideExisting);
            }
          }}
        >
          {isAnalyzing ? (
            <>
              <Loader size={14} className="animate-spin" aria-hidden="true" />
              <Pause size={14} aria-hidden="true" />
            </>
          ) : (
            <Play size={14} aria-hidden="true" />
          )}
        </button>
      </div>
      {photoAiMenuOpen ? (
        <div className="ml-3 grid gap-1.5 border-l border-border pl-3">
          <label className={submenuLabelClass}>
            <span>Include sub-folders</span>
            <input
              type="checkbox"
              className={submenuCheckboxClass}
              checked={aiIncludeSubfolders}
              disabled={isAnalyzing}
              onChange={(event) => setAiIncludeSubfolders(event.target.checked)}
            />
          </label>
          <label className={submenuLabelClass}>
            <span>Override existing</span>
            <input
              type="checkbox"
              className={submenuCheckboxClass}
              checked={aiOverrideExisting}
              disabled={isAnalyzing}
              onChange={(event) => setAiOverrideExisting(event.target.checked)}
            />
          </label>
        </div>
      ) : null}
      <div className="box-border flex min-h-[34px] w-full items-center justify-between gap-2 py-2 pl-2.5 pr-0 text-left text-sm leading-snug">
        <button type="button" className={rowLabelBtnClass} onClick={() => setSemanticMenuOpen((v) => !v)}>
          <ChevronRight
            size={14}
            className={cn(
              "shrink-0 transition-transform duration-150 ease-in-out",
              semanticMenuOpen && "rotate-90",
            )}
            aria-hidden="true"
          />
          {UI_TEXT.semanticIndexTitle}
        </button>
        <button
          type="button"
          className={cn(playBtnClass, "face-detect-play-btn")}
          disabled={!hasTargetFolder}
          title={isSemanticIndexing ? UI_TEXT.cancelSemanticIndex : "Start AI search indexing"}
          onClick={() => {
            if (isSemanticIndexing) {
              onCancelSemanticIndex();
            } else if (targetFolderPath) {
              onIndexSemantic(targetFolderPath, semanticIncludeSubfolders, semanticOverrideExisting);
            }
          }}
        >
          {isSemanticIndexing ? (
            <>
              <Loader size={14} className="animate-spin" aria-hidden="true" />
              <Pause size={14} aria-hidden="true" />
            </>
          ) : (
            <Play size={14} aria-hidden="true" />
          )}
        </button>
      </div>
      {semanticMenuOpen ? (
        <div className="ml-3 grid gap-1.5 border-l border-border pl-3">
          <label className={submenuLabelClass}>
            <span>Include sub-folders</span>
            <input
              type="checkbox"
              className={submenuCheckboxClass}
              checked={semanticIncludeSubfolders}
              disabled={isSemanticIndexing}
              onChange={(e) => setSemanticIncludeSubfolders(e.target.checked)}
            />
          </label>
          <label className={submenuLabelClass}>
            <span>Override existing</span>
            <input
              type="checkbox"
              className={submenuCheckboxClass}
              checked={semanticOverrideExisting}
              disabled={isSemanticIndexing}
              onChange={(e) => setSemanticOverrideExisting(e.target.checked)}
            />
          </label>
        </div>
      ) : null}
      {pathExtractionUseLlm && onAnalyzeFolderPathMetadata && onCancelPathAnalysis ? (
        <>
          <div className="box-border flex min-h-[34px] w-full items-center justify-between gap-2 py-2 pl-2.5 pr-0 text-left text-sm leading-snug">
            <button type="button" className={rowLabelBtnClass} onClick={() => setPathMenuOpen((v) => !v)}>
              <ChevronRight
                size={14}
                className={cn(
                  "shrink-0 transition-transform duration-150 ease-in-out",
                  pathMenuOpen && "rotate-90",
                )}
                aria-hidden="true"
              />
              {UI_TEXT.pathAnalysisMenuTitle}
            </button>
            <button
              type="button"
              className={cn(playBtnClass, "face-detect-play-btn")}
              disabled={!hasTargetFolder}
              title={isPathAnalysisRunning ? "Cancel path metadata extraction" : "Start path metadata (LLM)"}
              onClick={() => {
                if (isPathAnalysisRunning) {
                  onCancelPathAnalysis();
                } else if (targetFolderPath) {
                  onAnalyzeFolderPathMetadata(targetFolderPath, pathIncludeSubfolders);
                }
              }}
            >
              {isPathAnalysisRunning ? (
                <>
                  <Loader size={14} className="animate-spin" aria-hidden="true" />
                  <Pause size={14} aria-hidden="true" />
                </>
              ) : (
                <Play size={14} aria-hidden="true" />
              )}
            </button>
          </div>
          {pathMenuOpen ? (
            <div className="ml-3 grid gap-1.5 border-l border-border pl-3">
              <label className={submenuLabelClass}>
                <span>Include sub-folders</span>
                <input
                  type="checkbox"
                  className={submenuCheckboxClass}
                  checked={pathIncludeSubfolders}
                  disabled={isPathAnalysisRunning}
                  onChange={(e) => setPathIncludeSubfolders(e.target.checked)}
                />
              </label>
            </div>
          ) : null}
        </>
      ) : null}
      {/* TEMPORARY: description embedding backfill — remove after migration */}
      {onIndexDescEmbeddings ? (
        <div className="box-border flex min-h-[34px] w-full items-center justify-between gap-2 py-2 pl-2.5 pr-0 text-left text-sm leading-snug">
          <span className="inline-flex flex-1 items-center gap-2 px-0.5 font-inherit">{UI_TEXT.descEmbedBackfillTitle}</span>
          <button
            type="button"
            className={cn(playBtnClass, "face-detect-play-btn")}
            disabled={!hasTargetFolder || descEmbedBackfillRunning}
            title={
              descEmbedBackfillRunning
                ? UI_TEXT.cancelDescEmbedBackfill
                : "Build text embeddings from existing AI descriptions"
            }
            onClick={() => {
              if (descEmbedBackfillRunning) {
                onCancelDescEmbedBackfill?.();
              } else if (targetFolderPath) {
                onIndexDescEmbeddings(targetFolderPath, true);
              }
            }}
          >
            {descEmbedBackfillRunning ? (
              <>
                <Loader size={14} className="animate-spin" aria-hidden="true" />
                <Pause size={14} aria-hidden="true" />
              </>
            ) : (
              <Play size={14} aria-hidden="true" />
            )}
          </button>
        </div>
      ) : null}
    </>
  );
}

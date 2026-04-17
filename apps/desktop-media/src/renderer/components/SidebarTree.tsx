import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronRight, Loader, Loader2, MoreVertical, Pause, Play, Square } from "lucide-react";
import {
  DEFAULT_PHOTO_ANALYSIS_SETTINGS,
  type FolderAiSidebarRollup,
  type FolderAnalysisState,
  type FolderAnalysisStatus,
  type FolderNode,
  type PhotoPendingFolderIconTint,
} from "../../shared/ipc";
import { FolderAnalysisMenuSection } from "./FolderAnalysisMenuSection";
import { UI_TEXT } from "../lib/ui-text";
import { cn } from "../lib/cn";
import { photoPendingTintToSquareClass } from "../lib/photo-pending-folder-tint";
import { useDesktopStore } from "../stores/desktop-store";

let _openMenuPath: string | null = null;
let _openMenuAnchor: { x: number; y: number } | null = null;
const _openMenuListeners = new Set<() => void>();

function setOpenMenu(path: string | null, anchor: { x: number; y: number } | null): void {
  if (_openMenuPath === path && _openMenuAnchor?.x === anchor?.x && _openMenuAnchor?.y === anchor?.y) return;
  _openMenuPath = path;
  _openMenuAnchor = anchor;
  for (const fn of _openMenuListeners) fn();
}

function subscribeOpenMenu(listener: () => void): () => void {
  _openMenuListeners.add(listener);
  return () => { _openMenuListeners.delete(listener); };
}

function isEventInsideTreeMenu(target: Node): boolean {
  const el = target instanceof Element ? target : null;
  return Boolean(el?.closest?.("[data-sidebar-tree-menu]"));
}

function useIsMenuOpen(folderPath: string): boolean {
  const getSnapshot = useCallback(() => _openMenuPath === folderPath, [folderPath]);
  return useSyncExternalStore(subscribeOpenMenu, getSnapshot);
}

function useMenuAnchor(): { x: number; y: number } | null {
  const getSnapshot = useCallback(() => _openMenuAnchor, []);
  return useSyncExternalStore(subscribeOpenMenu, getSnapshot);
}

interface SidebarTreeProps {
  roots: string[];
  selectedFolder: string | null;
  expanded: Set<string>;
  childrenByPath: Record<string, FolderNode[]>;
  folderAnalysisByPath: Record<string, FolderAnalysisStatus>;
  folderRollupByPath: Record<string, FolderAiSidebarRollup>;
  foldersWithCatalogChanges: Record<string, boolean>;
  collapsed: boolean;
  onToggleExpand: (folderPath: string) => void;
  onSelectFolder: (folderPath: string) => void;
  onRemoveLibrary: (rootPath: string) => void;
  onScanForFileChanges: (folderPath: string, recursive: boolean) => void;
  onCancelMetadataScan: () => void;
  onAnalyzePhotos: (folderPath: string, recursive: boolean, overrideExisting: boolean) => void;
  onCancelAnalysis: () => void;
  onDetectFaces: (folderPath: string, recursive: boolean, overrideExisting: boolean) => void;
  onCancelFaceDetection: () => void;
  onIndexSemantic: (folderPath: string, recursive: boolean, overrideExisting: boolean) => void;
  onCancelSemanticIndex: () => void;
  onOpenFolderAiSummary: (folderPath: string) => void;
  onAnalyzeFolderPathMetadata?: (folderPath: string, recursive: boolean) => void;
  onCancelPathAnalysis?: () => void;
}

export function SidebarTree({
  roots,
  selectedFolder,
  expanded,
  childrenByPath,
  folderAnalysisByPath,
  folderRollupByPath,
  foldersWithCatalogChanges,
  collapsed,
  onToggleExpand,
  onSelectFolder,
  onRemoveLibrary,
  onScanForFileChanges,
  onCancelMetadataScan,
  onAnalyzePhotos,
  onCancelAnalysis,
  onDetectFaces,
  onCancelFaceDetection,
  onIndexSemantic,
  onCancelSemanticIndex,
  onOpenFolderAiSummary,
  onAnalyzeFolderPathMetadata,
  onCancelPathAnalysis,
}: SidebarTreeProps): ReactElement {
  const treeRef = useRef<HTMLDivElement | null>(null);
  const metadataStatus = useDesktopStore((s) => s.metadataStatus);
  const isMetadataScanRunning = metadataStatus === "running";

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const targetNode = event.target as Node | null;
      if (!targetNode) return;
      if (isEventInsideTreeMenu(targetNode)) return;
      setOpenMenu(null, null);
    };
    // Capture phase so portals / React handlers can't stop it.
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, []);

  return (
    <div ref={treeRef} className="flex min-w-full w-max flex-col">
      {roots.map((rootPath) => (
        <TreeNode
          key={rootPath}
          folderPath={rootPath}
          label={rootPath}
          hasSubdirectories={null}
          selectedFolder={selectedFolder}
          expanded={expanded}
          childrenByPath={childrenByPath}
          folderAnalysisByPath={folderAnalysisByPath}
          folderRollupByPath={folderRollupByPath}
          foldersWithCatalogChanges={foldersWithCatalogChanges}
          collapsed={collapsed}
          level={0}
          onToggleExpand={onToggleExpand}
          onSelectFolder={onSelectFolder}
          onRemoveLibrary={onRemoveLibrary}
          onScanForFileChanges={onScanForFileChanges}
          onCancelMetadataScan={onCancelMetadataScan}
          isMetadataScanRunning={isMetadataScanRunning}
          onAnalyzePhotos={onAnalyzePhotos}
          onCancelAnalysis={onCancelAnalysis}
          onDetectFaces={onDetectFaces}
          onCancelFaceDetection={onCancelFaceDetection}
          onIndexSemantic={onIndexSemantic}
          onCancelSemanticIndex={onCancelSemanticIndex}
          onOpenFolderAiSummary={onOpenFolderAiSummary}
          onAnalyzeFolderPathMetadata={onAnalyzeFolderPathMetadata}
          onCancelPathAnalysis={onCancelPathAnalysis}
        />
      ))}
    </div>
  );
}

interface FolderToggleIconProps {
  expanded: boolean;
}

function FolderToggleIcon({ expanded }: FolderToggleIconProps): ReactElement {
  return expanded ? (
    <ChevronDown className="block shrink-0" size={16} strokeWidth={2.1} aria-hidden="true" />
  ) : (
    <ChevronRight className="block shrink-0" size={16} strokeWidth={2.1} aria-hidden="true" />
  );
}

function sidebarIconTitle(
  analysisState: FolderAnalysisState,
  sidebarRollup: FolderAiSidebarRollup | undefined,
): string {
  if (analysisState === "in_progress") {
    return "AI job in progress for this folder";
  }
  if (sidebarRollup === undefined) {
    return "Loading folder AI status…";
  }
  if (sidebarRollup === "all_done") {
    return "Subtree: face, photo AI, and search index complete for all images";
  }
  if (sidebarRollup === "photo_analysis_waiting") {
    return "Subtree: face and search index complete; image analysis still pending";
  }
  if (sidebarRollup === "partial") {
    return "Subtree: some images still need one or more AI steps";
  }
  if (sidebarRollup === "not_done") {
    return "Subtree: AI pipelines not complete";
  }
  if (sidebarRollup === "empty") {
    return "No catalogued images in this subtree";
  }
  return "Folder not analyzed";
}

interface FolderSidebarStatusIconProps {
  analysisState: FolderAnalysisState;
  sidebarRollup: FolderAiSidebarRollup | undefined;
  photoPendingTint: PhotoPendingFolderIconTint;
}

function FolderSidebarStatusIcon({
  analysisState,
  sidebarRollup,
  photoPendingTint,
}: FolderSidebarStatusIconProps): ReactElement {
  if (analysisState === "in_progress") {
    return (
      <Loader2
        className="block shrink-0 animate-spin text-amber-300"
        size={14}
        strokeWidth={2.2}
        aria-hidden="true"
      />
    );
  }

  if (sidebarRollup === undefined) {
    return (
      <Loader2
        className="block shrink-0 animate-spin text-gray-400"
        size={14}
        strokeWidth={2.2}
        aria-hidden="true"
      />
    );
  }

  if (sidebarRollup === "all_done") {
    return (
      <Square
        className="block shrink-0 text-[hsl(var(--success))]"
        size={14}
        strokeWidth={2.1}
        aria-hidden="true"
      />
    );
  }
  if (sidebarRollup === "photo_analysis_waiting") {
    return (
      <Square
        className={cn("block shrink-0", photoPendingTintToSquareClass(photoPendingTint))}
        size={14}
        strokeWidth={2.1}
        aria-hidden="true"
      />
    );
  }
  if (sidebarRollup === "partial") {
    return <Square className="block shrink-0 text-amber-400" size={14} strokeWidth={2.1} aria-hidden="true" />;
  }
  if (sidebarRollup === "not_done") {
    return <Square className="block shrink-0 text-red-400" size={14} strokeWidth={2.1} aria-hidden="true" />;
  }
  if (sidebarRollup === "empty") {
    return (
      <Square className="block shrink-0 text-gray-500" size={14} strokeWidth={1.6} aria-hidden="true" />
    );
  }

  return <Square className="block shrink-0 text-[#aab4cc]" size={14} strokeWidth={1.8} aria-hidden="true" />;
}

interface TreeNodeProps {
  folderPath: string;
  label: string;
  hasSubdirectories: boolean | null;
  selectedFolder: string | null;
  expanded: Set<string>;
  childrenByPath: Record<string, FolderNode[]>;
  folderAnalysisByPath: Record<string, FolderAnalysisStatus>;
  folderRollupByPath: Record<string, FolderAiSidebarRollup>;
  foldersWithCatalogChanges: Record<string, boolean>;
  collapsed: boolean;
  level: number;
  onToggleExpand: (folderPath: string) => void;
  onSelectFolder: (folderPath: string) => void;
  onRemoveLibrary: (rootPath: string) => void;
  onScanForFileChanges: (folderPath: string, recursive: boolean) => void;
  onCancelMetadataScan: () => void;
  isMetadataScanRunning: boolean;
  onAnalyzePhotos: (folderPath: string, recursive: boolean, overrideExisting: boolean) => void;
  onCancelAnalysis: () => void;
  onDetectFaces: (folderPath: string, recursive: boolean, overrideExisting: boolean) => void;
  onCancelFaceDetection: () => void;
  onIndexSemantic: (folderPath: string, recursive: boolean, overrideExisting: boolean) => void;
  onCancelSemanticIndex: () => void;
  onOpenFolderAiSummary: (folderPath: string) => void;
  onAnalyzeFolderPathMetadata?: (folderPath: string, recursive: boolean) => void;
  onCancelPathAnalysis?: () => void;
}

function TreeNode({
  folderPath,
  label,
  hasSubdirectories,
  selectedFolder,
  expanded,
  childrenByPath,
  folderAnalysisByPath,
  folderRollupByPath,
  foldersWithCatalogChanges,
  collapsed,
  level,
  onToggleExpand,
  onSelectFolder,
  onRemoveLibrary,
  onScanForFileChanges,
  onCancelMetadataScan,
  isMetadataScanRunning,
  onAnalyzePhotos,
  onCancelAnalysis,
  onDetectFaces,
  onCancelFaceDetection,
  onIndexSemantic,
  onCancelSemanticIndex,
  onOpenFolderAiSummary,
  onAnalyzeFolderPathMetadata,
  onCancelPathAnalysis,
}: TreeNodeProps): ReactElement {
  const photoPendingFolderIconTint = useDesktopStore(
    (s) =>
      s.photoAnalysisSettings.folderIconWhenPhotoAnalysisPending ??
      DEFAULT_PHOTO_ANALYSIS_SETTINGS.folderIconWhenPhotoAnalysisPending,
  );
  const [scanMenuOpen, setScanMenuOpen] = useState(false);
  const [scanIncludeSubfolders, setScanIncludeSubfolders] = useState(true);
  const menuOpen = useIsMenuOpen(folderPath);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const globalAnchor = useMenuAnchor();
  const [menuPosition, setMenuPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!menuOpen) setScanMenuOpen(false);
  }, [menuOpen]);

  const closeMenu = useCallback(() => setOpenMenu(null, null), []);

  const computeMenuPosition = useCallback((): { left: number; top: number } | null => {
    if (!menuOpen || !globalAnchor) return null;
    const menuEl = menuRef.current;
    const menuWidth = menuEl?.offsetWidth ?? 0;
    const menuHeight = menuEl?.offsetHeight ?? 0;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const margin = 8;

    // Default: show menu with its top-left at the cursor.
    let left = globalAnchor.x;
    let top = globalAnchor.y;

    // If menu is measured, clamp it into the viewport.
    if (menuWidth > 0) {
      left = Math.min(Math.max(left, margin), viewportW - menuWidth - margin);
    } else {
      left = Math.min(Math.max(left, margin), viewportW - margin);
    }
    if (menuHeight > 0) {
      top = Math.min(Math.max(top, margin), viewportH - menuHeight - margin);
    } else {
      top = Math.min(Math.max(top, margin), viewportH - margin);
    }

    return { left, top };
  }, [globalAnchor, menuOpen]);

  // Track the menu position in viewport coords so it can overflow scroll containers.
  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPosition(null);
      return;
    }

    const next = computeMenuPosition();
    setMenuPosition((prev) => (prev?.left === next?.left && prev?.top === next?.top ? prev : next));

    const handle = () => {
      const updated = computeMenuPosition();
      setMenuPosition((prev) =>
        prev?.left === updated?.left && prev?.top === updated?.top ? prev : updated,
      );
    };

    window.addEventListener("resize", handle);
    // Capture scroll from any scroll container (sidebar tree, main content, etc).
    window.addEventListener("scroll", handle, true);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && menuRef.current) {
      ro = new ResizeObserver(() => handle());
      ro.observe(menuRef.current);
    }

    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
      ro?.disconnect();
    };
  }, [computeMenuPosition, menuOpen]);
  const isExpanded = expanded.has(folderPath);
  const children = childrenByPath[folderPath] ?? [];
  const hasKnownChildren = children.length > 0;
  const hasLoadedChildren = Object.prototype.hasOwnProperty.call(childrenByPath, folderPath);
  const canExpand =
    hasSubdirectories !== null ? hasSubdirectories : hasLoadedChildren ? hasKnownChildren : true;
  const analysisState = folderAnalysisByPath[folderPath]?.state ?? "not_scanned";
  const sidebarRollup = folderRollupByPath[folderPath];
  const iconTitle = sidebarIconTitle(analysisState, sidebarRollup);
  const rowClassName = cn(
    "group relative flex w-full items-center gap-0 rounded-md py-1 pl-1 pr-0",
    selectedFolder === folderPath && "bg-[#222a3d]",
    foldersWithCatalogChanges[folderPath] &&
      "shadow-[inset_0_0_0_1px_rgba(245,158,11,0.45)] rounded-md",
  );
  const isLibraryRoot = level === 0;
  const openMenuAt = useCallback(
    (anchor: { x: number; y: number }) => setOpenMenu(folderPath, anchor),
    [folderPath],
  );

  return (
    <div>
      <div
        className={rowClassName}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openMenuAt({ x: event.clientX, y: event.clientY });
        }}
      >
        <div
          className="flex min-h-0 min-w-0 flex-1 items-center gap-1.5"
          style={{ paddingLeft: `${level === 0 ? 0 : 8 + level * 12}px` }}
        >
          {canExpand ? (
            <button
              type="button"
              className="inline-flex h-7 min-w-7 w-7 items-center justify-center border-0 bg-transparent p-1.5 shadow-none rounded-none"
              onClick={() => onToggleExpand(folderPath)}
              aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
              title={`${isExpanded ? "Collapse folder" : "Expand folder"} - ${iconTitle}`}
            >
              <FolderToggleIcon expanded={isExpanded} />
            </button>
          ) : (
            <span className="inline-flex h-7 min-w-7 w-7 shrink-0" aria-hidden="true" />
          )}
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center justify-start gap-2 border-0 bg-transparent p-0 text-left shadow-none rounded-none"
            onClick={() => {
              if (canExpand && !isExpanded) {
                onToggleExpand(folderPath);
              }
              onSelectFolder(folderPath);
              closeMenu();
            }}
            title={label}
          >
            <span className="inline-flex h-3.5 min-w-3.5 w-3.5 shrink-0 items-center justify-center" title={iconTitle}>
              <FolderSidebarStatusIcon
                analysisState={analysisState}
                sidebarRollup={sidebarRollup}
                photoPendingTint={photoPendingFolderIconTint}
              />
            </span>
            {!collapsed && <span className="min-w-0 whitespace-nowrap">{label}</span>}
          </button>
        </div>
        {!collapsed ? (
          <div
            data-sidebar-tree-menu
            className={cn(
              "sticky right-0 z-[2] flex shrink-0 items-center pl-1",
              selectedFolder === folderPath
                ? "bg-[#222a3d]"
                : "bg-card shadow-[-6px_0_8px_-2px_rgba(0,0,0,0.35)]",
              "opacity-0 pointer-events-none transition-opacity duration-[120ms] ease-in-out",
              menuOpen
                ? "pointer-events-auto opacity-100 transition-none"
                : "group-hover:pointer-events-auto group-hover:opacity-100",
            )}
          >
            <button
              type="button"
              data-sidebar-tree-menu
              className="inline-flex h-[22px] w-[22px] items-center justify-center rounded border-0 bg-transparent p-0 text-[#c5d3ef] shadow-none hover:bg-[#1f2740]"
              aria-label="More"
              title="More"
              onClick={(event) => {
                event.stopPropagation();
                const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                // Prefer opening aligned to the button, not arbitrary mouse position.
                if (menuOpen) {
                  closeMenu();
                } else {
                  openMenuAt({ x: Math.round(rect.left), y: Math.round(rect.bottom + 4) });
                }
              }}
            >
              <MoreVertical size={14} aria-hidden="true" />
            </button>
            {menuOpen && menuPosition
              ? createPortal(
                  <div
                    ref={menuRef}
                    className="z-[1000] grid min-w-[260px] gap-1.5 rounded-lg border border-border bg-card p-2"
                    data-sidebar-tree-menu
                    style={{
                      position: "fixed",
                      left: menuPosition.left,
                      top: menuPosition.top,
                      right: "auto",
                    }}
                  >
                    <div className="box-border flex min-h-[34px] w-full items-center justify-between gap-2 py-2 pl-2.5 pr-0 text-left text-sm leading-snug">
                      <button
                        type="button"
                        className="inline-flex flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 px-0.5 text-left font-inherit text-inherit shadow-none"
                        onClick={() => setScanMenuOpen((v) => !v)}
                      >
                        <ChevronRight
                          size={14}
                          className={cn(
                            "shrink-0 transition-transform duration-150 ease-in-out",
                            scanMenuOpen && "rotate-90",
                          )}
                          aria-hidden="true"
                        />
                        {UI_TEXT.scanForFileChanges}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-transparent px-1.5 py-1 text-muted-foreground shadow-none transition-colors duration-150 hover:border-indigo-500 hover:bg-[#1e2a40] disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={!folderPath}
                        title={isMetadataScanRunning ? UI_TEXT.cancelScan : "Start metadata scan"}
                        onClick={() => {
                          if (isMetadataScanRunning) {
                            onCancelMetadataScan();
                          } else {
                            onScanForFileChanges(folderPath, scanIncludeSubfolders);
                            closeMenu();
                          }
                        }}
                      >
                        {isMetadataScanRunning ? (
                          <>
                            <Loader size={14} className="animate-spin" aria-hidden="true" />
                            <Pause size={14} aria-hidden="true" />
                          </>
                        ) : (
                          <Play size={14} aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    {scanMenuOpen ? (
                      <div className="ml-3 grid gap-1.5 border-l border-border pl-3">
                        <label className="flex min-h-8 items-center justify-between gap-2 text-[13px] leading-snug text-muted-foreground">
                          <span>Include sub-folders</span>
                          <input
                            type="checkbox"
                            className="h-4 w-4 min-w-0 cursor-pointer accent-indigo-500"
                            checked={scanIncludeSubfolders}
                            disabled={isMetadataScanRunning}
                            onChange={(event) => setScanIncludeSubfolders(event.target.checked)}
                          />
                        </label>
                      </div>
                    ) : null}
                    <div className="box-border flex min-h-[34px] w-full items-center px-2.5 py-2 text-left text-sm leading-snug">
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent p-0 px-0.5 text-left font-inherit leading-snug text-inherit shadow-none"
                        onClick={() => {
                          onOpenFolderAiSummary(folderPath);
                          closeMenu();
                        }}
                      >
                        <span className="h-0 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{UI_TEXT.folderAiAnalysisSummary}</span>
                      </button>
                    </div>
                    <FolderAnalysisMenuSection
                      targetFolderPath={folderPath}
                      onAnalyzePhotos={(path, recursive, overrideExisting) => {
                        onAnalyzePhotos(path, recursive, overrideExisting);
                        closeMenu();
                      }}
                      onCancelAnalysis={() => {
                        onCancelAnalysis();
                        closeMenu();
                      }}
                      onDetectFaces={(path, recursive, overrideExisting) => {
                        onDetectFaces(path, recursive, overrideExisting);
                        closeMenu();
                      }}
                      onCancelFaceDetection={() => {
                        onCancelFaceDetection();
                        closeMenu();
                      }}
                      onIndexSemantic={(path, recursive, overrideExisting) => {
                        onIndexSemantic(path, recursive, overrideExisting);
                        closeMenu();
                      }}
                      onCancelSemanticIndex={() => {
                        onCancelSemanticIndex();
                        closeMenu();
                      }}
                      onAnalyzeFolderPathMetadata={onAnalyzeFolderPathMetadata}
                      onCancelPathAnalysis={onCancelPathAnalysis}
                    />
                    {isLibraryRoot ? (
                      <div className="border-t border-border pt-1.5">
                        <div className="box-border flex min-h-[34px] w-full items-center px-2.5 py-2 text-left text-sm leading-snug">
                          <button
                            type="button"
                            className="w-full cursor-pointer border-0 bg-transparent p-0 px-0.5 text-left font-inherit leading-snug text-inherit shadow-none"
                            onClick={() => {
                              onRemoveLibrary(folderPath);
                              closeMenu();
                            }}
                          >
                            Remove (does not delete)
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>,
                  document.body,
                )
              : null}
          </div>
        ) : null}
      </div>

      {isExpanded && hasKnownChildren && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.path}
              folderPath={child.path}
              label={child.name}
              hasSubdirectories={child.hasSubdirectories}
              selectedFolder={selectedFolder}
              expanded={expanded}
              childrenByPath={childrenByPath}
              folderAnalysisByPath={folderAnalysisByPath}
              folderRollupByPath={folderRollupByPath}
              foldersWithCatalogChanges={foldersWithCatalogChanges}
              collapsed={collapsed}
              level={level + 1}
              onToggleExpand={onToggleExpand}
              onSelectFolder={onSelectFolder}
              onRemoveLibrary={onRemoveLibrary}
              onScanForFileChanges={onScanForFileChanges}
              onCancelMetadataScan={onCancelMetadataScan}
              isMetadataScanRunning={isMetadataScanRunning}
              onAnalyzePhotos={onAnalyzePhotos}
              onCancelAnalysis={onCancelAnalysis}
              onDetectFaces={onDetectFaces}
              onCancelFaceDetection={onCancelFaceDetection}
              onIndexSemantic={onIndexSemantic}
              onCancelSemanticIndex={onCancelSemanticIndex}
              onOpenFolderAiSummary={onOpenFolderAiSummary}
              onAnalyzeFolderPathMetadata={onAnalyzeFolderPathMetadata}
              onCancelPathAnalysis={onCancelPathAnalysis}
            />
          ))}
        </div>
      )}
    </div>
  );
}


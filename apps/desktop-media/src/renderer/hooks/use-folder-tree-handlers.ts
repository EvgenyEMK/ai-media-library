import { useMemo, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { refreshFolderAiRollups } from "./ipc-binding-helpers";
import { isPathWithinParent } from "../lib/is-path-within-parent";
import type { DesktopStore } from "../stores/desktop-store";
import type { MainPaneViewMode } from "../types/app-types";

const DEBUG_PHOTO_AI =
  typeof process !== "undefined" && process.env?.EMK_DEBUG_PHOTO_AI === "1";

function nowIso(): string {
  return new Date().toISOString();
}

export function useFolderTreeHandlers(opts: {
  store: DesktopStore;
  expandedFolders: Set<string>;
  activeFolderRequestIdRef: MutableRefObject<string | null>;
  lastCompletedFolderRequestIdRef: MutableRefObject<string | null>;
  setFolderLoadProgress: Dispatch<SetStateAction<{ loaded: number; total: number | null }>>;
  setMainPaneViewMode: Dispatch<SetStateAction<MainPaneViewMode>>;
}): {
  handleAddLibrary: () => Promise<void>;
  handleRemoveLibrary: (rootPath: string) => void;
  handleToggleExpand: (folderPath: string) => Promise<void>;
  handleSelectFolder: (folderPath: string) => Promise<void>;
  handleOpenFolderAiSummary: (folderPath: string) => void;
} {
  const {
    store,
    expandedFolders,
    activeFolderRequestIdRef,
    lastCompletedFolderRequestIdRef,
    setFolderLoadProgress,
    setMainPaneViewMode,
  } = opts;

  return useMemo(() => {
    const handleAddLibrary = async (): Promise<void> => {
      const picked = await window.desktopApi.selectLibraryFolder();
      if (!picked) return;
      store.getState().addLibraryRoot(picked);
    };

    const handleRemoveLibrary = (rootPath: string): void => {
      store.setState((s) => {
        s.libraryRoots = s.libraryRoots.filter((root) => root !== rootPath);

        if (s.selectedFolder && isPathWithinParent(s.selectedFolder, rootPath)) {
          s.selectedFolder = null;
          s.mediaItems = [];
          s.mediaMetadataByItemId = {};
          s.isFolderLoading = false;
        }

        s.expandedFolders = new Set(
          Array.from(s.expandedFolders).filter((expandedPath) => !isPathWithinParent(expandedPath, rootPath)),
        );

        for (const folderPath of Object.keys(s.childrenByPath)) {
          if (isPathWithinParent(folderPath, rootPath)) {
            delete s.childrenByPath[folderPath];
          }
        }
        for (const folderPath of Object.keys(s.folderAnalysisByPath)) {
          if (isPathWithinParent(folderPath, rootPath)) {
            delete s.folderAnalysisByPath[folderPath];
          }
        }
      });
    };

    const handleToggleExpand = async (folderPath: string): Promise<void> => {
      if (expandedFolders.has(folderPath)) {
        store.getState().toggleFolderExpand(folderPath);
        return;
      }

      const latestChildren = await window.desktopApi.readFolderChildren(folderPath);
      void window.desktopApi
        .pruneFolderAnalysisForMissingChildren(
          folderPath,
          latestChildren.map((child) => child.path),
        )
        .catch(() => undefined);
      const latestChildPaths = new Set(latestChildren.map((child) => child.path));

      store.setState((s) => {
        const previousChildren = s.childrenByPath[folderPath] ?? [];
        const removedChildRoots = previousChildren
          .filter((child) => !latestChildPaths.has(child.path))
          .map((child) => child.path);

        s.childrenByPath[folderPath] = latestChildren;

        if (removedChildRoots.length > 0) {
          const belongsToRemovedSubtree = (targetPath: string): boolean =>
            removedChildRoots.some((removedPath) => isPathWithinParent(targetPath, removedPath));

          s.expandedFolders = new Set(
            Array.from(s.expandedFolders).filter((expandedPath) => !belongsToRemovedSubtree(expandedPath)),
          );

          for (const childFolderPath of Object.keys(s.childrenByPath)) {
            if (belongsToRemovedSubtree(childFolderPath)) {
              delete s.childrenByPath[childFolderPath];
            }
          }
          for (const analysisPath of Object.keys(s.folderAnalysisByPath)) {
            if (belongsToRemovedSubtree(analysisPath)) {
              delete s.folderAnalysisByPath[analysisPath];
            }
          }

          if (s.selectedFolder && belongsToRemovedSubtree(s.selectedFolder)) {
            s.selectedFolder = null;
            s.mediaItems = [];
            s.mediaMetadataByItemId = {};
            s.isFolderLoading = false;
          }
        }

        s.expandedFolders.add(folderPath);
      });
      // Chevron-only expand does not run folder selection / media stream; still fetch AI rollups
      // for newly visible child rows (otherwise sidebar icons stay on the loading spinner).
      void refreshFolderAiRollups(store);
    };

    const handleSelectFolder = async (
      folderPath: string,
      options: { suppressAutoMetadataScan?: boolean } = {},
    ): Promise<void> => {
      activeFolderRequestIdRef.current = null;
      lastCompletedFolderRequestIdRef.current = null;
      setFolderLoadProgress({ loaded: 0, total: null });
      setMainPaneViewMode("media");
      store.getState().setFolderLoading(true);
      store.setState((s) => {
        s.selectedFolder = folderPath;
        s.mediaItems = [];
        s.mediaMetadataByItemId = {};
        s.semanticResults = [];
        s.semanticStatus = null;
        s.semanticSearching = false;
        s.semanticPanelOpen = false;
      });
      try {
        const { requestId } = await window.desktopApi.startFolderMediaStream({
          folderPath,
          suppressAutoMetadataScan: options.suppressAutoMetadataScan,
        });
        activeFolderRequestIdRef.current = requestId;
        if (DEBUG_PHOTO_AI) {
          console.log(
            `[folder-stream][renderer][${nowIso()}] startFolderMediaStream folder="${folderPath}" requestId=${requestId}`,
          );
        }
      } catch {
        activeFolderRequestIdRef.current = null;
        store.getState().setFolderLoading(false);
        if (DEBUG_PHOTO_AI) {
          console.log(
            `[folder-stream][renderer][${nowIso()}][error] startFolderMediaStream failed folder="${folderPath}"`,
          );
        }
      }
    };

    const handleOpenFolderAiSummary = (folderPath: string): void => {
      void (async () => {
        await handleSelectFolder(folderPath, { suppressAutoMetadataScan: true });
        setMainPaneViewMode("folderAiSummary");
      })();
    };

    return {
      handleAddLibrary,
      handleRemoveLibrary,
      handleToggleExpand,
      handleSelectFolder,
      handleOpenFolderAiSummary,
    };
  }, [
    store,
    expandedFolders,
    activeFolderRequestIdRef,
    lastCompletedFolderRequestIdRef,
    setFolderLoadProgress,
    setMainPaneViewMode,
  ]);
}

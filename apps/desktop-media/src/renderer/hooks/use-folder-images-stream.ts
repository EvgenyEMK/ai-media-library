import { useEffect, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { MediaLibraryItem } from "../../shared/ipc";
import type { MainPaneViewMode } from "../types/app-types";
import type { DesktopStore } from "../stores/desktop-store";

const DEBUG_PHOTO_AI =
  typeof process !== "undefined" && process.env?.EMK_DEBUG_PHOTO_AI === "1";

function nowIso(): string {
  return new Date().toISOString();
}

export function useFolderImagesStream(
  store: DesktopStore,
  mergeMetadataForPaths: (paths: string[], requestId: string) => Promise<void>,
  activeFolderRequestIdRef: MutableRefObject<string | null>,
  lastCompletedFolderRequestIdRef: MutableRefObject<string | null>,
  setMainPaneViewMode: Dispatch<SetStateAction<MainPaneViewMode>>,
): {
  folderLoadProgress: { loaded: number; total: number | null };
  setFolderLoadProgress: Dispatch<SetStateAction<{ loaded: number; total: number | null }>>;
} {
  const [folderLoadProgress, setFolderLoadProgress] = useState<{
    loaded: number;
    total: number | null;
  }>({ loaded: 0, total: null });

  useEffect(() => {
    const pendingItemsByRequest = new Map<string, MediaLibraryItem[]>();
    const pendingMetadataPathsByRequest = new Map<string, string[]>();
    const pendingLoadedByRequest = new Map<string, { loaded: number; total: number | null }>();
    const flushTimersByRequest = new Map<string, ReturnType<typeof setTimeout>>();

    const flushPendingForRequest = (requestId: string): void => {
      const timer = flushTimersByRequest.get(requestId);
      if (timer) {
        clearTimeout(timer);
        flushTimersByRequest.delete(requestId);
      }

      const progress = pendingLoadedByRequest.get(requestId);
      if (progress) {
        setFolderLoadProgress(progress);
        pendingLoadedByRequest.delete(requestId);
      }

      const pendingItems = pendingItemsByRequest.get(requestId);
      if (pendingItems && pendingItems.length > 0) {
        store.setState((s) => {
          s.mediaItems.push(
            ...pendingItems.map((img: MediaLibraryItem) => ({
              id: img.path,
              title: img.name,
              imageUrl: img.url,
              mediaType: img.mediaKind,
            })),
          );
        });
        pendingItemsByRequest.delete(requestId);
      }

      const pendingMetadataPaths = pendingMetadataPathsByRequest.get(requestId);
      if (pendingMetadataPaths && pendingMetadataPaths.length > 0) {
        void mergeMetadataForPaths(pendingMetadataPaths, requestId);
        pendingMetadataPathsByRequest.delete(requestId);
      }
    };

    const scheduleFlushForRequest = (requestId: string): void => {
      if (flushTimersByRequest.has(requestId)) return;
      const timer = setTimeout(() => flushPendingForRequest(requestId), 80);
      flushTimersByRequest.set(requestId, timer);
    };

    const lastLoggedLoadedByRequest = new Map<string, number>();
    const unsubscribe = window.desktopApi.onFolderMediaProgress((event) => {
      const activeRequestId = activeFolderRequestIdRef.current;
      if (!activeRequestId || event.requestId !== activeRequestId) return;

      if (event.type === "started") {
        setFolderLoadProgress({ loaded: event.loaded, total: event.total });
        if (DEBUG_PHOTO_AI) {
          console.log(
            `[folder-stream][renderer][${nowIso()}] started requestId=${event.requestId} folder="${event.folderPath}" loaded=${event.loaded}`,
          );
        }
        return;
      }
      if (event.type === "batch") {
        pendingLoadedByRequest.set(event.requestId, { loaded: event.loaded, total: event.total });
        const pendingItems = pendingItemsByRequest.get(event.requestId) ?? [];
        pendingItems.push(...event.items);
        pendingItemsByRequest.set(event.requestId, pendingItems);

        const pendingMetadataPaths = pendingMetadataPathsByRequest.get(event.requestId) ?? [];
        pendingMetadataPaths.push(...event.items.map((img) => img.path));
        pendingMetadataPathsByRequest.set(event.requestId, pendingMetadataPaths);

        scheduleFlushForRequest(event.requestId);
        if (DEBUG_PHOTO_AI) {
          const last = lastLoggedLoadedByRequest.get(event.requestId) ?? 0;
          if (event.loaded === 0 || event.loaded - last >= 200) {
            lastLoggedLoadedByRequest.set(event.requestId, event.loaded);
            console.log(
              `[folder-stream][renderer][${nowIso()}] batch requestId=${event.requestId} loaded=${event.loaded} (+${event.items.length}) folder="${event.folderPath}"`,
            );
          }
        }
        return;
      }
      if (event.type === "completed") {
        lastCompletedFolderRequestIdRef.current = event.requestId;
        flushPendingForRequest(event.requestId);
        setFolderLoadProgress({ loaded: event.loaded, total: event.total });
        store.getState().setFolderLoading(false);
        activeFolderRequestIdRef.current = null;
        if (DEBUG_PHOTO_AI) {
          console.log(
            `[folder-stream][renderer][${nowIso()}] completed requestId=${event.requestId} folder="${event.folderPath}" loaded=${event.loaded}`,
          );
        }
        if (event.loaded > 0) return;
        void (async () => {
          let children = store.getState().childrenByPath[event.folderPath];
          if (!children) {
            children = await window.desktopApi.readFolderChildren(event.folderPath);
            store.getState().setChildrenByPath(event.folderPath, children);
          }
          if (
            store.getState().folderScanningSettings.showFolderAiSummaryWhenSelectingEmptyFolder &&
            children.length > 0
          ) {
            setMainPaneViewMode("folderAiSummary");
          }
          if (children.length > 0 && !store.getState().expandedFolders.has(event.folderPath)) {
            store.getState().toggleFolderExpand(event.folderPath);
          }
        })();
        return;
      }
      if (event.type === "failed") {
        lastCompletedFolderRequestIdRef.current = event.requestId;
        flushPendingForRequest(event.requestId);
        activeFolderRequestIdRef.current = null;
        store.getState().setFolderLoading(false);
        if (DEBUG_PHOTO_AI) {
          console.log(
            `[folder-stream][renderer][${nowIso()}][error] failed requestId=${event.requestId} folder="${event.folderPath}" error="${event.error ?? ""}"`,
          );
        }
      }
    });

    return () => {
      unsubscribe();
      for (const timer of flushTimersByRequest.values()) {
        clearTimeout(timer);
      }
      flushTimersByRequest.clear();
    };
  }, [mergeMetadataForPaths, store, lastCompletedFolderRequestIdRef, setMainPaneViewMode]);

  return {
    folderLoadProgress,
    setFolderLoadProgress,
  };
}

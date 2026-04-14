import { useCallback, type MutableRefObject } from "react";
import type { DesktopMediaItemMetadata } from "../../shared/ipc";
import type { DesktopStore } from "../stores/desktop-store";

export function useFolderMetadataMerge(
  activeFolderRequestIdRef: MutableRefObject<string | null>,
  lastCompletedFolderRequestIdRef: MutableRefObject<string | null>,
  store: DesktopStore,
): {
  mergeMetadataForPaths: (paths: string[], requestId: string) => Promise<void>;
  refreshMetadataByPath: (sourcePath: string) => Promise<DesktopMediaItemMetadata | undefined>;
} {
  const mergeMetadataForPaths = useCallback(
    async (paths: string[], requestId: string): Promise<void> => {
      if (paths.length === 0 || activeFolderRequestIdRef.current !== requestId) return;
      try {
        const metadata = await window.desktopApi.getMediaItemsByPaths(paths);
        const stillActive = activeFolderRequestIdRef.current === requestId;
        const loadJustFinished =
          lastCompletedFolderRequestIdRef.current === requestId;
        if (!stillActive && !loadJustFinished) {
          return;
        }
        store.setState((s) => {
          for (const key of Object.keys(metadata)) {
            s.mediaMetadataByItemId[key] = metadata[key];
          }
        });
      } catch {
        /* best-effort */
      }
    },
    [activeFolderRequestIdRef, lastCompletedFolderRequestIdRef, store],
  );

  const refreshMetadataByPath = useCallback(
    async (sourcePath: string): Promise<DesktopMediaItemMetadata | undefined> => {
      try {
        const byPath = await window.desktopApi.getMediaItemsByPaths([sourcePath]);
        const updated = byPath[sourcePath] ?? Object.values(byPath)[0];
        if (Object.keys(byPath).length > 0) {
          store.setState((s) => {
            for (const key of Object.keys(byPath)) {
              s.mediaMetadataByItemId[key] = byPath[key];
            }
          });
        }
        return updated;
      } catch {
        return undefined;
      }
    },
    [store],
  );

  return { mergeMetadataForPaths, refreshMetadataByPath };
}

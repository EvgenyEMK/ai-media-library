import { useCallback } from "react";
import { comparableFilePath } from "../lib/media-metadata-lookup";
import { useDesktopStoreApi } from "../stores/desktop-store";

export function useMediaItemStarRatingChange(): (sourcePath: string, starRating: number) => Promise<void> {
  const store = useDesktopStoreApi();

  return useCallback(
    async (sourcePath: string, starRating: number) => {
      const result = await window.desktopApi.setMediaItemStarRating({
        sourcePath,
        starRating,
      });

      if (!result.success) {
        console.error(result.error ?? "Could not update star rating.");
        return;
      }

      if (result.metadata) {
        const meta = result.metadata;
        const keys = new Set(
          [sourcePath, meta.sourcePath, comparableFilePath(sourcePath), comparableFilePath(meta.sourcePath)].filter(
            (k) => typeof k === "string" && k.length > 0,
          ),
        );

        store.setState((s) => {
          const next = { ...s.mediaMetadataByItemId };
          for (const k of keys) {
            next[k] = meta;
          }
          s.mediaMetadataByItemId = next;
        });
      }

      if (result.fileWriteError) {
        console.warn(result.fileWriteError);
      }
    },
    [store],
  );
}

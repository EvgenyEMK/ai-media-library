import { useCallback } from "react";
import type { ViewerItemListEntry } from "@emk/media-store";
import type { DesktopMediaItemMetadata } from "../../shared/ipc";
import { toFileUrl } from "../components/face-cluster-utils";
import type { DesktopStore } from "../stores/desktop-store";

export function useDesktopViewerBridge(opts: {
  store: DesktopStore;
  mediaItems: Array<{ id: string; mediaType?: "image" | "video" }>;
  refreshMetadataByPath: (sourcePath: string) => Promise<DesktopMediaItemMetadata | undefined>;
}): {
  openFolderViewerById: (itemId: string) => void;
  openFacePhotoInViewer: (args: {
    sourcePath: string;
    imageWidth?: number | null;
    imageHeight?: number | null;
    mediaItemId?: string | null;
  }) => void;
} {
  const { store, mediaItems, refreshMetadataByPath } = opts;

  const openFolderViewerById = useCallback(
    (itemId: string): void => {
      const sourceIndex = mediaItems.findIndex((item) => item.id === itemId);
      if (sourceIndex >= 0) {
        const item = mediaItems[sourceIndex];
        const autoPlayInitialVideo = item?.mediaType === "video";
        store.setState({
          viewerOpen: true,
          viewerCurrentIndex: sourceIndex,
          viewerSource: "folder",
          viewerSelectedFaceIndex: null,
          viewerItemsOverride: null,
          viewerShowInfoPanel: false,
          viewerActiveInfoTab: null,
          viewerAutoPlayInitialVideo: autoPlayInitialVideo,
        });
        return;
      }
      const title = itemId.split(/[\\/]/).pop() ?? itemId;
      const isVideo = /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(itemId);
      const entry: ViewerItemListEntry = {
        id: itemId,
        sourcePath: itemId,
        title,
        storage_url: toFileUrl(itemId),
        thumbnail_url: toFileUrl(itemId),
        mediaType: isVideo ? "video" : "image",
      };
      store.setState({
        viewerOpen: true,
        viewerCurrentIndex: 0,
        viewerSource: "folder",
        viewerSelectedFaceIndex: null,
        viewerItemsOverride: [entry],
        viewerShowInfoPanel: false,
        viewerActiveInfoTab: null,
        viewerAutoPlayInitialVideo: isVideo,
      });
    },
    [mediaItems, store],
  );

  const openFacePhotoInViewer = useCallback(
    (args: {
      sourcePath: string;
      imageWidth?: number | null;
      imageHeight?: number | null;
      mediaItemId?: string | null;
    }): void => {
      const { sourcePath, imageWidth, imageHeight, mediaItemId } = args;
      const title = sourcePath.split(/[\\/]/).pop() ?? sourcePath;
      const url = toFileUrl(sourcePath);
      const faceViewerOptions = {
        showInfoPanel: true,
        activeInfoTab: "tags",
      } as const;
      const sourceIndex = mediaItems.findIndex((item) => item.id === sourcePath);
      if (sourceIndex >= 0) {
        store.getState().openViewer(sourceIndex, "folder", faceViewerOptions);
      } else {
        const entry: ViewerItemListEntry = {
          id: sourcePath,
          sourcePath,
          title,
          storage_url: url,
          thumbnail_url: url,
          width: imageWidth ?? null,
          height: imageHeight ?? null,
          mediaItemId: mediaItemId ?? null,
          mediaType: "image",
        };
        store.getState().openViewer(0, "folder", {
          ...faceViewerOptions,
          itemListOverride: [entry],
        });
      }
      void refreshMetadataByPath(sourcePath);
    },
    [mediaItems, store, refreshMetadataByPath],
  );

  return { openFolderViewerById, openFacePhotoInViewer };
}

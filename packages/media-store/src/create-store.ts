import { createStore } from "zustand/vanilla";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";

import { createSidebarSlice, type SidebarSlice } from "./slices/sidebar";
import { createContentPaneSlice, type ContentPaneSlice } from "./slices/content-pane";
import { createBottomPanelSlice, type BottomPanelSlice } from "./slices/bottom-panel";
import { createViewerSlice, type ViewerSlice } from "./slices/viewer";
import { createMediaItemsSlice, type MediaItemsSlice } from "./slices/media-items";
import { createAlbumsSlice, type AlbumsSlice } from "./slices/albums";
import { createFaceTagsSlice, type FaceTagsSlice } from "./slices/face-tags";
import { createMetadataScanSlice, type MetadataScanSlice } from "./slices/metadata-scan";
import { createAiAnalysisSlice, type AiAnalysisSlice } from "./slices/ai-analysis";
import { createFaceDetectionSlice, type FaceDetectionSlice } from "./slices/face-detection";
import { createFaceClusteringSlice, type FaceClusteringSlice } from "./slices/face-clustering";
import { createSemanticSearchSlice, type SemanticSearchSlice } from "./slices/semantic-search";

// Needed because several slices use Set (e.g. selectedItemIds).
enableMapSet();

export type MediaStoreState = SidebarSlice &
  ContentPaneSlice &
  BottomPanelSlice &
  ViewerSlice &
  MediaItemsSlice &
  AlbumsSlice &
  FaceTagsSlice &
  MetadataScanSlice &
  AiAnalysisSlice &
  FaceDetectionSlice &
  FaceClusteringSlice &
  SemanticSearchSlice;

export type MediaStore = ReturnType<typeof createMediaStore>;

export function createMediaStore(initialState?: Partial<MediaStoreState>) {
  return createStore<MediaStoreState>()(
    immer((...a) => ({
      ...createSidebarSlice(...(a as Parameters<typeof createSidebarSlice>)),
      ...createContentPaneSlice(...(a as Parameters<typeof createContentPaneSlice>)),
      ...createBottomPanelSlice(...(a as Parameters<typeof createBottomPanelSlice>)),
      ...createViewerSlice(...(a as Parameters<typeof createViewerSlice>)),
      ...createMediaItemsSlice(...(a as Parameters<typeof createMediaItemsSlice>)),
      ...createAlbumsSlice(...(a as Parameters<typeof createAlbumsSlice>)),
      ...createFaceTagsSlice(...(a as Parameters<typeof createFaceTagsSlice>)),
      ...createMetadataScanSlice(...(a as Parameters<typeof createMetadataScanSlice>)),
      ...createAiAnalysisSlice(...(a as Parameters<typeof createAiAnalysisSlice>)),
      ...createFaceDetectionSlice(...(a as Parameters<typeof createFaceDetectionSlice>)),
      ...createFaceClusteringSlice(...(a as Parameters<typeof createFaceClusteringSlice>)),
      ...createSemanticSearchSlice(...(a as Parameters<typeof createSemanticSearchSlice>)),
      ...initialState,
    })),
  );
}

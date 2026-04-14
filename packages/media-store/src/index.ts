// Types
export * from "./types";

// Store factory
export { createMediaStore, type MediaStoreState, type MediaStore } from "./create-store";

// React bindings
export { MediaStoreProvider, useMediaStore, useMediaStoreApi } from "./react";

// Slice types (for platform-specific store composition)
export type { SidebarSlice } from "./slices/sidebar";
export type { ContentPaneSlice } from "./slices/content-pane";
export type { BottomPanelSlice } from "./slices/bottom-panel";
export type {
  ViewerSlice,
  ViewerItemListEntry,
  OpenViewerOptions,
} from "./slices/viewer";
export type { MediaItemsSlice } from "./slices/media-items";
export type { AlbumsSlice } from "./slices/albums";
export type { FaceTagsSlice } from "./slices/face-tags";
export type { MetadataScanSlice, MetadataScanSummary } from "./slices/metadata-scan";
export type { AiAnalysisSlice } from "./slices/ai-analysis";
export type { FaceDetectionSlice } from "./slices/face-detection";
export type { FaceClusteringSlice, FaceClusteringProgressPhase } from "./slices/face-clustering";
export type {
  SemanticSearchSlice,
  SemanticSearchScope,
  SemanticSearchSignalMode,
  SemanticIndexPhase,
} from "./slices/semantic-search";

// UI components
export { BottomPanel, type BottomPanelProps } from "./components/bottom-panel";

// Slice creators (for platform-specific store composition)
export { createSidebarSlice } from "./slices/sidebar";
export { createContentPaneSlice } from "./slices/content-pane";
export { createBottomPanelSlice } from "./slices/bottom-panel";
export { createViewerSlice } from "./slices/viewer";
export { createMediaItemsSlice } from "./slices/media-items";
export { createAlbumsSlice } from "./slices/albums";
export { createFaceTagsSlice } from "./slices/face-tags";
export { createMetadataScanSlice } from "./slices/metadata-scan";
export { createAiAnalysisSlice } from "./slices/ai-analysis";
export { createFaceDetectionSlice } from "./slices/face-detection";
export { createFaceClusteringSlice } from "./slices/face-clustering";
export { createSemanticSearchSlice } from "./slices/semantic-search";

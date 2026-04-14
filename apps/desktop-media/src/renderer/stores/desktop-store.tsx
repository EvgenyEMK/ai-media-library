"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { createStore } from "zustand";
import { useStore } from "zustand";
import { immer } from "zustand/middleware/immer";
import { enableMapSet } from "immer";

import {
  createSidebarSlice,
  createContentPaneSlice,
  createBottomPanelSlice,
  createViewerSlice,
  createMediaItemsSlice,
  createAlbumsSlice,
  createFaceTagsSlice,
  createMetadataScanSlice,
  createAiAnalysisSlice,
  createFaceDetectionSlice,
  createFaceClusteringSlice,
  createSemanticSearchSlice,
  type SidebarSlice,
  type ContentPaneSlice,
  type BottomPanelSlice,
  type ViewerSlice,
  type MediaItemsSlice,
  type AlbumsSlice,
  type FaceTagsSlice,
  type MetadataScanSlice,
  type AiAnalysisSlice,
  type FaceDetectionSlice,
  type FaceClusteringSlice,
  type SemanticSearchSlice,
} from "@emk/media-store";

import { createDesktopSlice, type DesktopSlice } from "./desktop-slice";

// Desktop slice uses Set (expandedFolders), so enable Map/Set drafting in Immer.
enableMapSet();

export type DesktopStoreState = SidebarSlice &
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
  SemanticSearchSlice &
  DesktopSlice;

export function createDesktopStore(initialState?: Partial<DesktopStoreState>) {
  return createStore<DesktopStoreState>()(
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
      ...createDesktopSlice(...(a as Parameters<typeof createDesktopSlice>)),
      ...initialState,
    })),
  );
}

export type DesktopStore = ReturnType<typeof createDesktopStore>;

const DesktopStoreContext = createContext<DesktopStore | null>(null);

interface DesktopStoreProviderProps {
  children: ReactNode;
  initialState?: Partial<DesktopStoreState>;
}

export function DesktopStoreProvider({ children, initialState }: DesktopStoreProviderProps): ReactNode {
  const storeRef = useRef<DesktopStore | undefined>(undefined);
  if (!storeRef.current) {
    storeRef.current = createDesktopStore(initialState);
  }
  return (
    <DesktopStoreContext.Provider value={storeRef.current}>
      {children}
    </DesktopStoreContext.Provider>
  );
}

export function useDesktopStore<T>(selector: (state: DesktopStoreState) => T): T {
  const store = useContext(DesktopStoreContext);
  if (!store) {
    throw new Error("useDesktopStore must be used within a <DesktopStoreProvider>");
  }
  return useStore(store, selector);
}

export function useDesktopStoreApi(): DesktopStore {
  const store = useContext(DesktopStoreContext);
  if (!store) {
    throw new Error("useDesktopStoreApi must be used within a <DesktopStoreProvider>");
  }
  return store;
}

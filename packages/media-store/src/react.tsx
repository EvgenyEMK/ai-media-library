"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import { createMediaStore, type MediaStore, type MediaStoreState } from "./create-store";

const MediaStoreContext = createContext<MediaStore | null>(null);

interface MediaStoreProviderProps {
  children: ReactNode;
  initialState?: Partial<MediaStoreState>;
}

export function MediaStoreProvider({ children, initialState }: MediaStoreProviderProps): ReactNode {
  const storeRef = useRef<MediaStore | undefined>(undefined);
  if (!storeRef.current) {
    storeRef.current = createMediaStore(initialState);
  }
  return (
    <MediaStoreContext.Provider value={storeRef.current}>
      {children}
    </MediaStoreContext.Provider>
  );
}

/**
 * Subscribe to a slice of the media store with a selector.
 * Components re-render only when the selected value changes (shallow equality by default).
 */
export function useMediaStore<T>(selector: (state: MediaStoreState) => T): T {
  const store = useContext(MediaStoreContext);
  if (!store) {
    throw new Error("useMediaStore must be used within a <MediaStoreProvider>");
  }
  return useStore(store, selector);
}

/**
 * Get the raw store instance for non-reactive access (IPC handlers, server-action callbacks, etc.).
 */
export function useMediaStoreApi(): MediaStore {
  const store = useContext(MediaStoreContext);
  if (!store) {
    throw new Error("useMediaStoreApi must be used within a <MediaStoreProvider>");
  }
  return store;
}

import { describe, it, expect } from "vitest";
import { createStore } from "zustand/vanilla";
import { immer } from "zustand/middleware/immer";
import { createViewerSlice, type ViewerSlice } from "./viewer";

function createTestStore() {
  return createStore<ViewerSlice>()(immer(createViewerSlice));
}

describe("ViewerSlice", () => {
  it("starts with viewer closed", () => {
    const store = createTestStore();
    const state = store.getState();
    expect(state.viewerOpen).toBe(false);
    expect(state.viewerCurrentIndex).toBe(0);
    expect(state.viewerSource).toBeNull();
    expect(state.viewerItemsOverride).toBeNull();
  });

  it("opens the viewer at a given index with source", () => {
    const store = createTestStore();
    store.getState().openViewer(5, "folder");

    const state = store.getState();
    expect(state.viewerOpen).toBe(true);
    expect(state.viewerCurrentIndex).toBe(5);
    expect(state.viewerSource).toBe("folder");
    expect(state.viewerItemsOverride).toBeNull();
    expect(state.viewerShowInfoPanel).toBe(false);
  });

  it("resets selectedFaceIndex when opening", () => {
    const store = createTestStore();
    store.getState().setViewerSelectedFaceIndex(3);
    store.getState().openViewer(0, "album");

    expect(store.getState().viewerSelectedFaceIndex).toBeNull();
  });

  it("closes the viewer", () => {
    const store = createTestStore();
    store.getState().openViewer(2, "search");
    store.getState().closeViewer();

    const closed = store.getState();
    expect(closed.viewerOpen).toBe(false);
    expect(closed.viewerSelectedFaceIndex).toBeNull();
    expect(closed.viewerShowInfoPanel).toBe(false);
    expect(closed.viewerActiveInfoTab).toBeNull();
    expect(closed.viewerItemsOverride).toBeNull();
  });

  it("changes the current index and clears selected face", () => {
    const store = createTestStore();
    store.getState().openViewer(0, "folder");
    store.getState().setViewerSelectedFaceIndex(1);
    store.getState().setViewerCurrentIndex(10);

    expect(store.getState().viewerCurrentIndex).toBe(10);
    expect(store.getState().viewerSelectedFaceIndex).toBeNull();
  });

  it("toggles info panel", () => {
    const store = createTestStore();
    expect(store.getState().viewerShowInfoPanel).toBe(false);

    store.getState().toggleViewerInfoPanel();
    expect(store.getState().viewerShowInfoPanel).toBe(true);

    store.getState().toggleViewerInfoPanel();
    expect(store.getState().viewerShowInfoPanel).toBe(false);
  });

  it("sets info panel visibility directly", () => {
    const store = createTestStore();
    store.getState().setViewerShowInfoPanel(true);
    expect(store.getState().viewerShowInfoPanel).toBe(true);
  });

  it("sets active info tab", () => {
    const store = createTestStore();
    store.getState().setViewerActiveInfoTab("details");
    expect(store.getState().viewerActiveInfoTab).toBe("details");

    store.getState().setViewerActiveInfoTab(null);
    expect(store.getState().viewerActiveInfoTab).toBeNull();
  });

  it("sets selected face index", () => {
    const store = createTestStore();
    store.getState().setViewerSelectedFaceIndex(2);
    expect(store.getState().viewerSelectedFaceIndex).toBe(2);
  });

  it("opens with info panel and item list override", () => {
    const store = createTestStore();
    const items = [
      {
        id: "/a/photo.jpg",
        sourcePath: "/a/photo.jpg",
        title: "photo.jpg",
        storage_url: "file:///a/photo.jpg",
        thumbnail_url: "file:///a/photo.jpg",
      },
    ];
    store.getState().openViewer(0, "folder", {
      showInfoPanel: true,
      activeInfoTab: "tags",
      itemListOverride: items,
    });
    const state = store.getState();
    expect(state.viewerShowInfoPanel).toBe(true);
    expect(state.viewerActiveInfoTab).toBe("tags");
    expect(state.viewerItemsOverride).toEqual(items);
  });
});

import { describe, it, expect } from "vitest";
import { createStore } from "zustand/vanilla";
import { immer } from "zustand/middleware/immer";
import { createSidebarSlice, type SidebarSlice } from "./sidebar";

function createTestStore() {
  return createStore<SidebarSlice>()(immer(createSidebarSlice));
}

describe("SidebarSlice", () => {
  it("starts with sidebar expanded", () => {
    const store = createTestStore();
    expect(store.getState().sidebarCollapsed).toBe(false);
    expect(store.getState().sidebarActiveSection).toBeNull();
  });

  it("toggles collapse state", () => {
    const store = createTestStore();
    store.getState().toggleSidebarCollapsed();
    expect(store.getState().sidebarCollapsed).toBe(true);

    store.getState().toggleSidebarCollapsed();
    expect(store.getState().sidebarCollapsed).toBe(false);
  });

  it("sets collapse state directly", () => {
    const store = createTestStore();
    store.getState().setSidebarCollapsed(true);
    expect(store.getState().sidebarCollapsed).toBe(true);

    store.getState().setSidebarCollapsed(false);
    expect(store.getState().sidebarCollapsed).toBe(false);
  });

  it("sets active section", () => {
    const store = createTestStore();
    store.getState().setSidebarActiveSection("folders");
    expect(store.getState().sidebarActiveSection).toBe("folders");

    store.getState().setSidebarActiveSection("faceTags");
    expect(store.getState().sidebarActiveSection).toBe("faceTags");
  });

  it("clears active section", () => {
    const store = createTestStore();
    store.getState().setSidebarActiveSection("albums");
    store.getState().setSidebarActiveSection(null);
    expect(store.getState().sidebarActiveSection).toBeNull();
  });
});

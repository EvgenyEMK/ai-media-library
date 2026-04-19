import { describe, it, expect } from "vitest";
import { createStore } from "zustand/vanilla";
import { immer } from "zustand/middleware/immer";
import { createSemanticSearchSlice, type SemanticSearchSlice } from "./semantic-search";

function createTestStore() {
  return createStore<SemanticSearchSlice>()(immer(createSemanticSearchSlice));
}

describe("SemanticSearchSlice signal mode", () => {
  it("defaults to hybrid", () => {
    const store = createTestStore();
    expect(store.getState().semanticSearchSignalMode).toBe("hybrid");
  });

  it("setSemanticSearchSignalMode updates mode", () => {
    const store = createTestStore();
    store.getState().setSemanticSearchSignalMode("vlm-only");
    expect(store.getState().semanticSearchSignalMode).toBe("vlm-only");
    store.getState().setSemanticSearchSignalMode("description-only");
    expect(store.getState().semanticSearchSignalMode).toBe("description-only");
    store.getState().setSemanticSearchSignalMode("hybrid-max");
    expect(store.getState().semanticSearchSignalMode).toBe("hybrid-max");
  });
});

import type { StateCreator } from "zustand";
import type { PersonTag } from "../types";

export interface FaceTagsSlice {
  personTags: PersonTag[];
  activeTagId: string | null;

  setPersonTags: (tags: PersonTag[]) => void;
  addPersonTag: (tag: PersonTag) => void;
  removePersonTag: (id: string) => void;
  setActiveTagId: (id: string | null) => void;
}

export const createFaceTagsSlice: StateCreator<FaceTagsSlice, [["zustand/immer", never]]> = (set) => ({
  personTags: [],
  activeTagId: null,

  setPersonTags: (tags) =>
    set((state) => {
      state.personTags = tags;
    }),

  addPersonTag: (tag) =>
    set((state) => {
      state.personTags.push(tag);
    }),

  removePersonTag: (id) =>
    set((state) => {
      state.personTags = state.personTags.filter((t) => t.id !== id);
      if (state.activeTagId === id) {
        state.activeTagId = null;
      }
    }),

  setActiveTagId: (id) =>
    set((state) => {
      state.activeTagId = id;
    }),
});

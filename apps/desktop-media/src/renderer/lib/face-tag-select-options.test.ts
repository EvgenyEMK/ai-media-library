import { describe, expect, it } from "vitest";
import {
  getAlphabeticalFaceTagOptions,
  getSearchFaceTagOptions,
  getTopFaceTagOptions,
} from "./face-tag-select-options";
import type { DesktopPersonTagWithFaceCount } from "../../shared/ipc";

const baseTags: DesktopPersonTagWithFaceCount[] = [
  { id: "a", label: "Alice", pinned: false, birthDate: null, taggedFaceCount: 9, similarFaceCount: 0 },
  { id: "b", label: "Bob", pinned: false, birthDate: null, taggedFaceCount: 7, similarFaceCount: 0 },
  { id: "c", label: "Carol", pinned: false, birthDate: null, taggedFaceCount: 6, similarFaceCount: 0 },
  { id: "d", label: "Dylan", pinned: false, birthDate: null, taggedFaceCount: 5, similarFaceCount: 0 },
  { id: "e", label: "Eve", pinned: false, birthDate: null, taggedFaceCount: 4, similarFaceCount: 0 },
  { id: "f", label: "Frank", pinned: false, birthDate: null, taggedFaceCount: 3, similarFaceCount: 0 },
  { id: "g", label: "Grace", pinned: false, birthDate: null, taggedFaceCount: 2, similarFaceCount: 0 },
  { id: "h", label: "Hector", pinned: false, birthDate: null, taggedFaceCount: 1, similarFaceCount: 0 },
];

describe("face-tag-select-options", () => {
  it("returns top seven most used person tags", () => {
    const result = getTopFaceTagOptions(baseTags);
    expect(result).toHaveLength(7);
    expect(result.map((tag) => tag.id)).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
  });

  it("puts the selected tag first in the top section", () => {
    const result = getTopFaceTagOptions(baseTags, "h");
    expect(result).toHaveLength(7);
    expect(result.map((tag) => tag.id)).toEqual(["h", "a", "b", "c", "d", "e", "f"]);
  });

  it("returns all person tags in alphabetical order", () => {
    const shuffled = [baseTags[3], baseTags[0], baseTags[2], baseTags[1]];
    const result = getAlphabeticalFaceTagOptions(shuffled);
    expect(result.map((tag) => tag.label)).toEqual(["Alice", "Bob", "Carol", "Dylan"]);
  });

  it("excludes tags already rendered in the top section", () => {
    const result = getAlphabeticalFaceTagOptions(baseTags, new Set(["a", "c"]));
    expect(result.map((tag) => tag.id)).not.toContain("a");
    expect(result.map((tag) => tag.id)).not.toContain("c");
  });

  it("filters by case-insensitive substring", () => {
    const result = getSearchFaceTagOptions(baseTags, "AL");
    expect(result.map((tag) => tag.id)).toEqual(["a"]);
  });

  it("returns all matching tags without a hard cap", () => {
    const tags = baseTags.map((tag, idx) => ({ ...tag, label: `Person ${idx}` }));
    const result = getSearchFaceTagOptions(tags, "person");
    expect(result).toHaveLength(tags.length);
  });
});

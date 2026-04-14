import { describe, expect, it } from "vitest";
import {
  getSemanticSearchVisiblePersonTagIds,
  getTaggedFacesTabVisibleTagIds,
  semanticSearchPersonTagsShouldOfferShowAll,
  taggedFacesTabShouldOfferShowAll,
  type PersonTagListMeta,
} from "./tagged-faces-tab-visible-tags";

function tag(
  id: string,
  label: string,
  opts: { pinned?: boolean; count?: number } = {},
): PersonTagListMeta {
  return {
    id,
    label,
    pinned: opts.pinned ?? false,
    taggedFaceCount: opts.count ?? 0,
  };
}

describe("getTaggedFacesTabVisibleTagIds", () => {
  it("shows only pinned when collapsed and no filter", () => {
    const allTags = [tag("a", "Ann", { pinned: true }), tag("b", "Bob", { count: 99 })];
    expect(
      getTaggedFacesTabVisibleTagIds({
        allTags,
        nameFilterTrimmed: "",
        tagsListExpanded: false,
        lastSelectedNonPinnedIds: [],
        selectedTagId: null,
      }),
    ).toEqual(["a"]);
  });

  it("shows top 5 by tagged face count when no pins", () => {
    const allTags = [
      tag("a", "A", { count: 1 }),
      tag("b", "B", { count: 5 }),
      tag("c", "C", { count: 3 }),
      tag("d", "D", { count: 2 }),
      tag("e", "E", { count: 4 }),
      tag("f", "F", { count: 10 }),
    ];
    expect(
      getTaggedFacesTabVisibleTagIds({
        allTags,
        nameFilterTrimmed: "",
        tagsListExpanded: false,
        lastSelectedNonPinnedIds: [],
        selectedTagId: null,
      }),
    ).toEqual(["f", "b", "e", "c", "d"]);
  });

  it("appends up to 3 recent non-pinned after pinned block in MRU order", () => {
    const allTags = [
      tag("p", "Pin", { pinned: true }),
      tag("x", "X"),
      tag("y", "Y"),
      tag("z", "Z"),
    ];
    expect(
      getTaggedFacesTabVisibleTagIds({
        allTags,
        nameFilterTrimmed: "",
        tagsListExpanded: false,
        lastSelectedNonPinnedIds: ["z", "y", "x"],
        selectedTagId: null,
      }),
    ).toEqual(["p", "z", "y", "x"]);
  });

  it("dedupes recent list against pinned", () => {
    const allTags = [tag("p", "Pin", { pinned: true }), tag("x", "X")];
    expect(
      getTaggedFacesTabVisibleTagIds({
        allTags,
        nameFilterTrimmed: "",
        tagsListExpanded: false,
        lastSelectedNonPinnedIds: ["x", "p"],
        selectedTagId: null,
      }),
    ).toEqual(["p", "x"]);
  });

  it("filters by name when filter is non-empty", () => {
    const allTags = [tag("a", "Alice"), tag("b", "Bob")];
    expect(
      getTaggedFacesTabVisibleTagIds({
        allTags,
        nameFilterTrimmed: "bo",
        tagsListExpanded: false,
        lastSelectedNonPinnedIds: [],
        selectedTagId: null,
      }),
    ).toEqual(["b"]);
  });

  it("appends selected tag if not in visible set", () => {
    const allTags = [tag("a", "Ann", { pinned: true }), tag("b", "Bob")];
    expect(
      getTaggedFacesTabVisibleTagIds({
        allTags,
        nameFilterTrimmed: "",
        tagsListExpanded: false,
        lastSelectedNonPinnedIds: [],
        selectedTagId: "b",
      }),
    ).toEqual(["a", "b"]);
  });
});

describe("taggedFacesTabShouldOfferShowAll", () => {
  it("is false when expanded or filter active", () => {
    const allTags = [tag("a", "A", { pinned: true }), tag("b", "B")];
    expect(
      taggedFacesTabShouldOfferShowAll({
        allTags,
        nameFilterTrimmed: "",
        tagsListExpanded: true,
        lastSelectedNonPinnedIds: [],
      }),
    ).toBe(false);
    expect(
      taggedFacesTabShouldOfferShowAll({
        allTags,
        nameFilterTrimmed: "b",
        tagsListExpanded: false,
        lastSelectedNonPinnedIds: [],
      }),
    ).toBe(false);
  });

  it("is true when more tags exist than collapsed visible", () => {
    const allTags = [tag("a", "A", { pinned: true }), tag("b", "B"), tag("c", "C")];
    expect(
      taggedFacesTabShouldOfferShowAll({
        allTags,
        nameFilterTrimmed: "",
        tagsListExpanded: false,
        lastSelectedNonPinnedIds: [],
      }),
    ).toBe(true);
  });
});

describe("getSemanticSearchVisiblePersonTagIds", () => {
  it("matches collapsed Tagged-faces behavior when no multi-selection", () => {
    const allTags = [tag("a", "Ann", { pinned: true }), tag("b", "Bob", { count: 99 })];
    expect(
      getSemanticSearchVisiblePersonTagIds({
        allTags,
        nameFilterTrimmed: "",
        tagsListExpanded: false,
        lastToggledNonPinnedIds: [],
        selectedTagIds: [],
      }),
    ).toEqual(
      getTaggedFacesTabVisibleTagIds({
        allTags,
        nameFilterTrimmed: "",
        tagsListExpanded: false,
        lastSelectedNonPinnedIds: [],
        selectedTagId: null,
      }),
    );
  });

  it("appends every selected tag that is not already visible when collapsed", () => {
    const allTags = [
      tag("a", "Ann", { pinned: true }),
      tag("b", "Bob"),
      tag("c", "Carl"),
    ];
    expect(
      getSemanticSearchVisiblePersonTagIds({
        allTags,
        nameFilterTrimmed: "",
        tagsListExpanded: false,
        lastToggledNonPinnedIds: [],
        selectedTagIds: ["b", "c"],
      }),
    ).toEqual(["a", "b", "c"]);
  });
});

describe("semanticSearchPersonTagsShouldOfferShowAll", () => {
  it("mirrors taggedFacesTabShouldOfferShowAll when no selection is applied", () => {
    const allTags = [tag("a", "A", { pinned: true }), tag("b", "B"), tag("c", "C")];
    const args = {
      allTags,
      nameFilterTrimmed: "",
      tagsListExpanded: false,
      lastToggledNonPinnedIds: [] as string[],
    };
    expect(semanticSearchPersonTagsShouldOfferShowAll(args)).toBe(
      taggedFacesTabShouldOfferShowAll({
        ...args,
        lastSelectedNonPinnedIds: args.lastToggledNonPinnedIds,
      }),
    );
  });
});

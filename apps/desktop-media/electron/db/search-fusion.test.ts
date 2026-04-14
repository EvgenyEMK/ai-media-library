import { describe, it, expect } from "vitest";
import { fuseWithRRF, toRankedList, type RankedItem } from "./search-fusion";

describe("fuseWithRRF", () => {
  it("returns empty array when given no lists", () => {
    expect(fuseWithRRF([])).toEqual([]);
  });

  it("returns empty array when all lists are empty", () => {
    expect(fuseWithRRF([[], []])).toEqual([]);
  });

  it("preserves order of a single list", () => {
    const list: RankedItem[] = [
      { mediaItemId: "a", rank: 1 },
      { mediaItemId: "b", rank: 2 },
      { mediaItemId: "c", rank: 3 },
    ];
    const result = fuseWithRRF([list]);
    expect(result.map((r) => r.mediaItemId)).toEqual(["a", "b", "c"]);
  });

  it("boosts items appearing in multiple lists", () => {
    const vision: RankedItem[] = [
      { mediaItemId: "piano-only", rank: 1 },
      { mediaItemId: "dress-only", rank: 2 },
      { mediaItemId: "full-scene", rank: 3 },
    ];
    const keyword: RankedItem[] = [
      { mediaItemId: "full-scene", rank: 1 },
      { mediaItemId: "dress-only", rank: 2 },
      { mediaItemId: "unrelated", rank: 3 },
    ];

    const result = fuseWithRRF([vision, keyword]);
    // full-scene appears in both lists -> should be #1
    expect(result[0].mediaItemId).toBe("full-scene");
    // dress-only appears in both -> should be #2
    expect(result[1].mediaItemId).toBe("dress-only");
  });

  it("uses k parameter for smoothing", () => {
    const list: RankedItem[] = [
      { mediaItemId: "a", rank: 1 },
      { mediaItemId: "b", rank: 2 },
    ];
    const k = 10;
    const result = fuseWithRRF([list], k);

    expect(result[0].rrfScore).toBeCloseTo(1 / (k + 1), 10);
    expect(result[1].rrfScore).toBeCloseTo(1 / (k + 2), 10);
  });

  it("correctly sums scores across lists", () => {
    const k = 60;
    const listA: RankedItem[] = [{ mediaItemId: "x", rank: 1 }];
    const listB: RankedItem[] = [{ mediaItemId: "x", rank: 5 }];

    const result = fuseWithRRF([listA, listB], k);
    const expected = 1 / (k + 1) + 1 / (k + 5);
    expect(result[0].rrfScore).toBeCloseTo(expected, 10);
  });

  it("respects the limit parameter", () => {
    const list: RankedItem[] = Array.from({ length: 20 }, (_, i) => ({
      mediaItemId: `item-${i}`,
      rank: i + 1,
    }));
    const result = fuseWithRRF([list], 60, 5);
    expect(result).toHaveLength(5);
    expect(result[0].mediaItemId).toBe("item-0");
  });

  it("handles duplicate mediaItemIds within a single list gracefully", () => {
    const list: RankedItem[] = [
      { mediaItemId: "a", rank: 1 },
      { mediaItemId: "a", rank: 3 },
    ];
    const k = 60;
    const result = fuseWithRRF([list], k);
    expect(result).toHaveLength(1);
    expect(result[0].rrfScore).toBeCloseTo(1 / (k + 1) + 1 / (k + 3), 10);
  });

  it("scenario: compositional query ranks multi-match items above single-list items", () => {
    // Simulates "lady in white dress near piano"
    // Vision sees piano-room as very similar visually (rank 1) and full scene lower (rank 5)
    // BM25 matches full scene perfectly on keywords (rank 1), piano-room is keyword-partial (rank 4)
    // A "vision-only" item and "keyword-only" item appear in just one list each.
    const vision: RankedItem[] = [
      { mediaItemId: "piano-room", rank: 1 },
      { mediaItemId: "white-dress-portrait", rank: 2 },
      { mediaItemId: "concert-hall", rank: 3 },
      { mediaItemId: "vision-only-sunset", rank: 4 },
      { mediaItemId: "lady-piano-dress", rank: 5 },
    ];
    const bm25: RankedItem[] = [
      { mediaItemId: "lady-piano-dress", rank: 1 },
      { mediaItemId: "white-dress-portrait", rank: 2 },
      { mediaItemId: "keyword-only-blog", rank: 3 },
      { mediaItemId: "piano-room", rank: 4 },
    ];

    const result = fuseWithRRF([vision, bm25]);
    const top3 = result.slice(0, 3).map((r) => r.mediaItemId);

    // Items appearing in both lists should outrank single-list items
    expect(top3).toContain("lady-piano-dress");
    expect(top3).toContain("white-dress-portrait");
    expect(top3).toContain("piano-room");

    // Items only in one list should rank lower
    const singleListItems = result.filter(
      (r) => r.mediaItemId === "vision-only-sunset" || r.mediaItemId === "keyword-only-blog",
    );
    const lowestDualListScore = Math.min(
      ...result.filter((r) => top3.includes(r.mediaItemId)).map((r) => r.rrfScore),
    );
    for (const item of singleListItems) {
      expect(item.rrfScore).toBeLessThan(lowestDualListScore);
    }
  });
});

describe("toRankedList", () => {
  it("assigns 1-based ranks in order", () => {
    const items = [
      { mediaItemId: "a", score: 0.9 },
      { mediaItemId: "b", score: 0.7 },
      { mediaItemId: "c", score: 0.5 },
    ];
    const ranked = toRankedList(items);
    expect(ranked).toEqual([
      { mediaItemId: "a", rank: 1 },
      { mediaItemId: "b", rank: 2 },
      { mediaItemId: "c", rank: 3 },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(toRankedList([])).toEqual([]);
  });
});

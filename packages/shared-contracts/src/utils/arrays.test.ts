import { describe, it, expect } from "vitest";
import { chunkArray } from "./arrays";

describe("chunkArray", () => {
  it("splits an array into equal-size chunks", () => {
    expect(chunkArray([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  it("handles a final partial chunk", () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns one chunk when size >= array length", () => {
    expect(chunkArray([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
    expect(chunkArray([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
  });

  it("returns empty array for empty input", () => {
    expect(chunkArray([], 3)).toEqual([]);
  });

  it("chunks size-1 into individual elements", () => {
    expect(chunkArray(["a", "b", "c"], 1)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("preserves type with generic arrays", () => {
    const result = chunkArray([{ id: 1 }, { id: 2 }, { id: 3 }], 2);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result[1]).toEqual([{ id: 3 }]);
  });
});

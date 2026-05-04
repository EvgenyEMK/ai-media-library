import { describe, expect, it } from "vitest";
import { moveItemIdToInsertBefore } from "./reorder-ordered-ids";

describe("moveItemIdToInsertBefore", () => {
  it("returns null when id is absent", () => {
    expect(moveItemIdToInsertBefore(["a", "b"], "x", 0)).toBeNull();
  });

  it("returns null when order is unchanged", () => {
    expect(moveItemIdToInsertBefore(["a", "b", "c"], "b", 2)).toBeNull();
  });

  it("moves to front", () => {
    expect(moveItemIdToInsertBefore(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
  });

  it("moves to end", () => {
    expect(moveItemIdToInsertBefore(["a", "b", "c"], "a", 3)).toEqual(["b", "c", "a"]);
  });

  it("moves between neighbors", () => {
    expect(moveItemIdToInsertBefore(["a", "b", "c", "d"], "d", 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("clamps insert index", () => {
    expect(moveItemIdToInsertBefore(["a", "b", "c"], "a", 99)).toEqual(["b", "c", "a"]);
    expect(moveItemIdToInsertBefore(["a", "b", "c"], "c", -5)).toEqual(["c", "a", "b"]);
  });
});

import { describe, expect, it } from "vitest";
import { orderPendingPipelineItems, type PipelineImageItem } from "./pipeline-item-order";

const A: PipelineImageItem = { path: "a.jpg", name: "a.jpg", folderPath: "root" };
const B: PipelineImageItem = { path: "b.jpg", name: "b.jpg", folderPath: "root" };
const C: PipelineImageItem = { path: "c.jpg", name: "c.jpg", folderPath: "root" };
const D: PipelineImageItem = { path: "d.jpg", name: "d.jpg", folderPath: "root" };
const E: PipelineImageItem = { path: "e.jpg", name: "e.jpg", folderPath: "root/sub-a" };
const F: PipelineImageItem = { path: "f.jpg", name: "f.jpg", folderPath: "root/sub-b" };

describe("orderPendingPipelineItems", () => {
  it("keeps fresh items first and pushes previously failed items to end", () => {
    const ordered = orderPendingPipelineItems(
      [A, B, C, D],
      new Set(["b.jpg", "d.jpg"]),
      false,
    );
    expect(ordered.map((x) => x.path)).toEqual(["a.jpg", "c.jpg", "b.jpg", "d.jpg"]);
  });

  it("skips previously failed items when skip flag is true", () => {
    const ordered = orderPendingPipelineItems(
      [A, B, C, D],
      new Set(["b.jpg", "d.jpg"]),
      true,
    );
    expect(ordered.map((x) => x.path)).toEqual(["a.jpg", "c.jpg"]);
  });

  it("preserves relative order within fresh and failed groups", () => {
    const ordered = orderPendingPipelineItems(
      [D, B, C, A],
      new Set(["d.jpg", "a.jpg"]),
      false,
    );
    expect(ordered.map((x) => x.path)).toEqual(["b.jpg", "c.jpg", "d.jpg", "a.jpg"]);
  });

  it("applies ordering globally across sub-folders (not per folder chunk)", () => {
    const ordered = orderPendingPipelineItems(
      [E, F, A, B],
      new Set(["e.jpg", "a.jpg"]),
      false,
    );
    expect(ordered.map((x) => x.path)).toEqual(["f.jpg", "b.jpg", "e.jpg", "a.jpg"]);
  });
});

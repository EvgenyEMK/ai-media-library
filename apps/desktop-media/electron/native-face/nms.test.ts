import { describe, expect, it } from "vitest";
import { nms } from "./nms";

describe("nms", () => {
  it("keeps a single box", () => {
    const boxes = new Float32Array([10, 10, 50, 50]);
    const scores = new Float32Array([0.9]);
    const kept = nms(boxes, scores, 0.5);
    expect(kept).toEqual([0]);
  });

  it("keeps non-overlapping boxes", () => {
    const boxes = new Float32Array([
      10, 10, 50, 50,
      100, 100, 150, 150,
    ]);
    const scores = new Float32Array([0.9, 0.8]);
    const kept = nms(boxes, scores, 0.5);
    expect(kept).toEqual([0, 1]);
  });

  it("suppresses overlapping box with lower score", () => {
    const boxes = new Float32Array([
      10, 10, 50, 50,
      12, 12, 52, 52,
    ]);
    const scores = new Float32Array([0.9, 0.8]);
    const kept = nms(boxes, scores, 0.3);
    expect(kept).toEqual([0]);
  });

  it("keeps both when overlap is below threshold", () => {
    const boxes = new Float32Array([
      10, 10, 50, 50,
      40, 40, 80, 80,
    ]);
    const scores = new Float32Array([0.9, 0.8]);
    const kept = nms(boxes, scores, 0.9);
    expect(kept).toEqual([0, 1]);
  });

  it("handles empty input", () => {
    const kept = nms(new Float32Array(0), new Float32Array(0), 0.5);
    expect(kept).toEqual([]);
  });

  it("returns highest-scoring box first", () => {
    const boxes = new Float32Array([
      10, 10, 50, 50,
      100, 100, 150, 150,
    ]);
    const scores = new Float32Array([0.5, 0.9]);
    const kept = nms(boxes, scores, 0.5);
    expect(kept[0]).toBe(1);
    expect(kept[1]).toBe(0);
  });
});

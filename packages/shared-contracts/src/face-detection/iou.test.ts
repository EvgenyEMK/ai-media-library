import { describe, expect, it } from "vitest";
import {
  boxArea,
  greedyMatchBoxesByIou,
  iouXyxy,
  rescaleBoxToImageSize,
} from "./iou";

describe("iouXyxy", () => {
  it("returns 1 for identical boxes", () => {
    const a = { x1: 10, y1: 10, x2: 30, y2: 30 };
    expect(iouXyxy(a, a)).toBe(1);
  });

  it("returns 0 for disjoint boxes", () => {
    const a = { x1: 0, y1: 0, x2: 10, y2: 10 };
    const b = { x1: 20, y1: 20, x2: 30, y2: 30 };
    expect(iouXyxy(a, b)).toBe(0);
  });

  it("computes correct IoU for partial overlap", () => {
    const a = { x1: 0, y1: 0, x2: 10, y2: 10 };
    const b = { x1: 5, y1: 5, x2: 15, y2: 15 };
    // intersection = 5*5 = 25, union = 100 + 100 - 25 = 175
    expect(iouXyxy(a, b)).toBeCloseTo(25 / 175, 6);
  });

  it("returns 0 for zero-area boxes", () => {
    const a = { x1: 10, y1: 10, x2: 10, y2: 10 };
    const b = { x1: 0, y1: 0, x2: 10, y2: 10 };
    expect(iouXyxy(a, b)).toBe(0);
  });
});

describe("boxArea", () => {
  it("computes area", () => {
    expect(boxArea({ x1: 0, y1: 0, x2: 4, y2: 3 })).toBe(12);
  });
  it("clamps negative width/height to 0", () => {
    expect(boxArea({ x1: 10, y1: 10, x2: 5, y2: 5 })).toBe(0);
  });
});

describe("rescaleBoxToImageSize", () => {
  it("returns xyxy from xywh when ref equals target", () => {
    const r = rescaleBoxToImageSize(
      { x: 10, y: 20, width: 30, height: 40, refWidth: 100, refHeight: 100 },
      { width: 100, height: 100 },
    );
    expect(r).toEqual({ x1: 10, y1: 20, x2: 40, y2: 60 });
  });

  it("scales box when ref differs from target", () => {
    const r = rescaleBoxToImageSize(
      { x: 10, y: 20, width: 30, height: 40, refWidth: 100, refHeight: 100 },
      { width: 200, height: 200 },
    );
    expect(r).toEqual({ x1: 20, y1: 40, x2: 80, y2: 120 });
  });

  it("falls back to identity when ref is missing", () => {
    const r = rescaleBoxToImageSize(
      { x: 10, y: 20, width: 30, height: 40 },
      { width: 200, height: 200 },
    );
    expect(r).toEqual({ x1: 10, y1: 20, x2: 40, y2: 60 });
  });
});

describe("greedyMatchBoxesByIou", () => {
  it("matches best pairs 1-to-1 and respects threshold", () => {
    const newBoxes = [
      { item: "a", box: { x1: 0, y1: 0, x2: 10, y2: 10 } },
      { item: "b", box: { x1: 100, y1: 100, x2: 110, y2: 110 } },
      { item: "c", box: { x1: 500, y1: 500, x2: 510, y2: 510 } },
    ];
    const oldBoxes = [
      { item: "X", box: { x1: 102, y1: 102, x2: 112, y2: 112 } },
      { item: "Y", box: { x1: 1, y1: 1, x2: 11, y2: 11 } },
      { item: "Z", box: { x1: 5, y1: 5, x2: 15, y2: 15 } },
    ];
    const matches = greedyMatchBoxesByIou(newBoxes, oldBoxes, 0.3);

    expect(matches.get(0)?.oldIndex).toBe(1);
    expect(matches.get(1)?.oldIndex).toBe(0);
    expect(matches.has(2)).toBe(false);
  });

  it("prevents a single old box from being claimed twice", () => {
    const newBoxes = [
      { item: "a", box: { x1: 0, y1: 0, x2: 10, y2: 10 } },
      { item: "b", box: { x1: 0, y1: 0, x2: 10, y2: 10 } },
    ];
    const oldBoxes = [
      { item: "X", box: { x1: 1, y1: 1, x2: 11, y2: 11 } },
    ];
    const matches = greedyMatchBoxesByIou(newBoxes, oldBoxes, 0.5);
    expect(matches.size).toBe(1);
  });
});

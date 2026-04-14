import { describe, expect, it } from "vitest";
import { estimateSimilarityTransform, warpAffine, alignFace, ARCFACE_REF_LANDMARKS } from "./affine-warp";
import type { RawImage } from "./image-utils";

describe("estimateSimilarityTransform", () => {
  it("returns identity when src equals dst", () => {
    const pts: Array<[number, number]> = [
      [10, 20], [30, 20], [20, 35], [12, 45], [28, 45],
    ];
    const [a, mb, tx, b, a2, ty] = estimateSimilarityTransform(pts, pts);

    expect(a).toBeCloseTo(1, 5);
    expect(mb).toBeCloseTo(0, 5);
    expect(tx).toBeCloseTo(0, 3);
    expect(b).toBeCloseTo(0, 5);
    expect(a2).toBeCloseTo(1, 5);
    expect(ty).toBeCloseTo(0, 3);
  });

  it("detects pure translation", () => {
    const src: Array<[number, number]> = [[0, 0], [10, 0], [5, 10], [2, 15], [8, 15]];
    const dst: Array<[number, number]> = [[5, 3], [15, 3], [10, 13], [7, 18], [13, 18]];
    const [a, mb, tx, b, a2, ty] = estimateSimilarityTransform(src, dst);

    expect(a).toBeCloseTo(1, 4);
    expect(mb).toBeCloseTo(0, 4);
    expect(tx).toBeCloseTo(5, 2);
    expect(b).toBeCloseTo(0, 4);
    expect(a2).toBeCloseTo(1, 4);
    expect(ty).toBeCloseTo(3, 2);
  });

  it("detects uniform scaling", () => {
    const src: Array<[number, number]> = [[0, 0], [10, 0], [5, 10]];
    const dst: Array<[number, number]> = [[0, 0], [20, 0], [10, 20]];
    const [a, _mb, _tx, _b, a2] = estimateSimilarityTransform(src, dst);

    expect(a).toBeCloseTo(2, 4);
    expect(a2).toBeCloseTo(2, 4);
  });
});

describe("warpAffine", () => {
  it("identity transform preserves the image", () => {
    const src: RawImage = {
      data: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 128, 128, 128]),
      width: 2,
      height: 2,
      channels: 3,
    };
    const result = warpAffine(src, [1, 0, 0, 0, 1, 0], 2, 2);

    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.data[0]).toBe(255); // R of pixel (0,0)
    expect(result.data[1]).toBe(0);
    expect(result.data[2]).toBe(0);
  });
});

describe("alignFace", () => {
  it("produces output of the requested size", () => {
    const src: RawImage = {
      data: new Uint8Array(200 * 200 * 3),
      width: 200,
      height: 200,
      channels: 3,
    };
    const landmarks: Array<[number, number]> = [
      [60, 80], [140, 80], [100, 120], [70, 155], [130, 155],
    ];
    const result = alignFace(src, landmarks, [112, 112]);
    expect(result.width).toBe(112);
    expect(result.height).toBe(112);
    expect(result.data.length).toBe(112 * 112 * 3);
  });
});

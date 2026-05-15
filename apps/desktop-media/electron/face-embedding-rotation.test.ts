import { describe, expect, it } from "vitest";
import { transformFaceForRotatedEmbedding } from "./face-embedding-rotation";

describe("transformFaceForRotatedEmbedding", () => {
  it("transforms a bounding box and landmarks into a 90-degree rotated copy", () => {
    const result = transformFaceForRotatedEmbedding({
      bbox: [10, 20, 30, 50],
      landmarks: [
        [12, 22],
        [28, 22],
        [20, 35],
        [14, 46],
        [26, 46],
      ],
      angle: 90,
      originalSize: { width: 100, height: 80 },
    });

    expect(result.bbox).toEqual([29, 10, 59, 30]);
    expect(result.landmarks).toEqual([
      [57, 12],
      [57, 28],
      [44, 20],
      [33, 14],
      [33, 26],
    ]);
  });

  it("keeps bbox coordinates ordered after a 270-degree rotation", () => {
    const result = transformFaceForRotatedEmbedding({
      bbox: [10, 20, 30, 50],
      landmarks: null,
      angle: 270,
      originalSize: { width: 100, height: 80 },
    });

    expect(result.bbox).toEqual([20, 69, 50, 89]);
    expect(result.landmarks).toBeUndefined();
  });
});

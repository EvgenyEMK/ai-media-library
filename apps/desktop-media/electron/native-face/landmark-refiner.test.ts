import { describe, expect, it } from "vitest";
import { reduce98To5 } from "./landmark-refiner";

function buildSynthetic98(): Float32Array {
  // Layout the 98 landmarks in a synthetic but internally-consistent face:
  //   - Right eye group (60-67): cluster around (0.3, 0.4)
  //   - Left eye group (68-75): cluster around (0.7, 0.4)
  //   - Nose (54): at (0.5, 0.55)
  //   - Mouth outer (76, 82): at (0.35, 0.75) and (0.65, 0.75)
  // Everything else can stay at 0 — reduce98To5 only consumes those.
  const flat = new Float32Array(196);
  const setPt = (i: number, x: number, y: number) => {
    flat[i * 2] = x;
    flat[i * 2 + 1] = y;
  };

  for (let i = 60; i <= 67; i++) {
    setPt(i, 0.28 + 0.04 * ((i - 60) / 7), 0.4);
  }
  for (let i = 68; i <= 75; i++) {
    setPt(i, 0.68 + 0.04 * ((i - 68) / 7), 0.4);
  }
  setPt(54, 0.5, 0.55);
  setPt(76, 0.35, 0.75);
  setPt(82, 0.65, 0.75);
  return flat;
}

describe("reduce98To5", () => {
  it("returns five points in ArcFace order (viewer-left, viewer-right, nose, left_mouth, right_mouth)", () => {
    const pts = reduce98To5(buildSynthetic98());
    expect(pts).toHaveLength(5);
    const [leftEye, rightEye, nose, leftMouth, rightMouth] = pts;

    expect(leftEye[0]).toBeLessThan(rightEye[0]);
    expect(leftMouth[0]).toBeLessThan(rightMouth[0]);
    expect(nose[0]).toBeCloseTo(0.5, 5);
    expect(nose[1]).toBeCloseTo(0.55, 5);
    expect(leftEye[1]).toBeCloseTo(0.4, 3);
    expect(rightEye[1]).toBeCloseTo(0.4, 3);
    expect(leftMouth[1]).toBeCloseTo(0.75, 5);
    expect(rightMouth[1]).toBeCloseTo(0.75, 5);
  });

  it("orders eye centroids by viewer-x regardless of which WFLW group encodes which eye", () => {
    const normal = buildSynthetic98();
    const flipped = new Float32Array(normal);
    // Swap the two eye groups' x coordinates.
    for (let i = 60; i <= 67; i++) {
      flipped[i * 2] = normal[(i + 8) * 2];
    }
    for (let i = 68; i <= 75; i++) {
      flipped[i * 2] = normal[(i - 8) * 2];
    }
    const pts = reduce98To5(flipped);
    expect(pts[0][0]).toBeLessThan(pts[1][0]);
  });

  it("throws on insufficient input length", () => {
    expect(() => reduce98To5(new Float32Array(50))).toThrow();
  });
});

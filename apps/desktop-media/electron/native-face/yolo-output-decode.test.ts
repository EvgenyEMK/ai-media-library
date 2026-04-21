import { describe, expect, it } from "vitest";
import {
  approximateLandmarksFromXyxy,
  decodeEnd2EndSix,
  runNmsOnDecoded,
} from "./yolo-output-decode";

const map = {
  scale: 0.5,
  padX: 100,
  padY: 50,
  imgW: 800,
  imgH: 600,
};

describe("decodeEnd2EndSix", () => {
  it("parses [1, 3, 6] row-major and maps to original image", () => {
    // One face in top-left of letterbox (pixel coords): small box
    const data = new Float32Array([
      10, 10, 110, 110, 0.9, 0,
      0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0,
    ]);
    const decoded = decodeEnd2EndSix(data, [1, 3, 6], 0.25, map);
    expect(decoded.scores.length).toBe(1);
    const kept = runNmsOnDecoded(decoded, 0.45, 10);
    expect(kept.length).toBe(1);
    const k = kept[0]!;
    const x2 = decoded.pixelBoxes[k * 4 + 2];
    const y2 = decoded.pixelBoxes[k * 4 + 3];
    expect(x2).toBeGreaterThan(decoded.pixelBoxes[k * 4]);
    expect(y2).toBeGreaterThan(decoded.pixelBoxes[k * 4 + 1]);
  });

  it("parses [1, 6, 3] column-major (Ultralytics-style)", () => {
    const data = new Float32Array(18);
    const n = 3;
    // Anchor 0: xyxy + conf + cls — layout is outData[c * n + i]
    data[0 * n + 0] = 20;
    data[1 * n + 0] = 20;
    data[2 * n + 0] = 120;
    data[3 * n + 0] = 120;
    data[4 * n + 0] = 0.95;
    data[5 * n + 0] = 0;
    const decoded = decodeEnd2EndSix(data, [1, 6, 3], 0.25, map);
    expect(decoded.scores.length).toBeGreaterThanOrEqual(1);
  });
});

describe("approximateLandmarksFromXyxy", () => {
  it("returns 5 points inside the box", () => {
    const lm = approximateLandmarksFromXyxy([100, 200, 200, 400]);
    expect(lm).toHaveLength(5);
    for (const [x, y] of lm) {
      expect(x).toBeGreaterThanOrEqual(100);
      expect(x).toBeLessThanOrEqual(200);
      expect(y).toBeGreaterThanOrEqual(200);
      expect(y).toBeLessThanOrEqual(400);
    }
  });
});

import { describe, expect, it } from "vitest";
import { generatePriors } from "./prior-box";
import { RETINAFACE_MOBILENETV2 } from "./config";

describe("generatePriors", () => {
  it("generates the expected number of priors for a 640x480 image", () => {
    const priors = generatePriors(640, 480, RETINAFACE_MOBILENETV2);
    const numPriors = priors.length / 4;

    // Feature map sizes: ceil(480/8)*ceil(640/8)=60*80,
    //                    ceil(480/16)*ceil(640/16)=30*40,
    //                    ceil(480/32)*ceil(640/32)=15*20
    // Each cell has 2 anchors.
    const expected = 2 * (60 * 80 + 30 * 40 + 15 * 20);
    expect(numPriors).toBe(expected);
  });

  it("generates the expected number of priors for a 1920x1080 image", () => {
    const priors = generatePriors(1920, 1080, RETINAFACE_MOBILENETV2);
    const numPriors = priors.length / 4;

    const expected =
      2 * (Math.ceil(1080 / 8) * Math.ceil(1920 / 8) +
        Math.ceil(1080 / 16) * Math.ceil(1920 / 16) +
        Math.ceil(1080 / 32) * Math.ceil(1920 / 32));
    expect(numPriors).toBe(expected);
  });

  it("prior values are in normalized [0,1] range for interior cells", () => {
    const priors = generatePriors(640, 480, RETINAFACE_MOBILENETV2);
    const numPriors = priors.length / 4;

    let allInRange = true;
    for (let i = 0; i < numPriors; i++) {
      const cx = priors[i * 4];
      const cy = priors[i * 4 + 1];
      if (cx < 0 || cx > 1.5 || cy < 0 || cy > 1.5) {
        allInRange = false;
        break;
      }
    }
    expect(allInRange).toBe(true);
  });

  it("first prior has correct cx,cy for step=8, minSize=16", () => {
    const priors = generatePriors(640, 480, RETINAFACE_MOBILENETV2);
    const cx = priors[0];
    const cy = priors[1];
    const w = priors[2];
    const h = priors[3];

    expect(cx).toBeCloseTo(0.5 * 8 / 640, 6);
    expect(cy).toBeCloseTo(0.5 * 8 / 480, 6);
    expect(w).toBeCloseTo(16 / 640, 6);
    expect(h).toBeCloseTo(16 / 480, 6);
  });
});

import { describe, expect, it } from "vitest";
import { decodeBoxes, decodeLandmarks } from "./decode";

describe("decodeBoxes", () => {
  it("returns identity box when loc deltas are zero", () => {
    // 1 prior at center (0.5, 0.5) with size (0.2, 0.2)
    const priors = new Float32Array([0.5, 0.5, 0.2, 0.2]);
    const loc = new Float32Array([0, 0, 0, 0]);
    const variance: [number, number] = [0.1, 0.2];

    const boxes = decodeBoxes(loc, priors, variance);

    // cx=0.5, cy=0.5, w=0.2*exp(0)=0.2, h=0.2
    expect(boxes[0]).toBeCloseTo(0.4, 6); // x1 = 0.5 - 0.1
    expect(boxes[1]).toBeCloseTo(0.4, 6); // y1
    expect(boxes[2]).toBeCloseTo(0.6, 6); // x2 = 0.5 + 0.1
    expect(boxes[3]).toBeCloseTo(0.6, 6); // y2
  });

  it("handles positive location deltas correctly", () => {
    const priors = new Float32Array([0.5, 0.5, 0.1, 0.1]);
    // loc: [1, 1, 0, 0] → shift cx/cy by variance[0]*prior_wh = 0.1*0.1 = 0.01
    const loc = new Float32Array([1, 1, 0, 0]);
    const variance: [number, number] = [0.1, 0.2];

    const boxes = decodeBoxes(loc, priors, variance);

    const cx = 0.5 + 1 * 0.1 * 0.1; // 0.51
    const w = 0.1;
    expect(boxes[0]).toBeCloseTo(cx - w / 2, 6);
    expect(boxes[2]).toBeCloseTo(cx + w / 2, 6);
  });
});

describe("decodeLandmarks", () => {
  it("returns prior center when raw predictions are zero", () => {
    const priors = new Float32Array([0.5, 0.5, 0.2, 0.2]);
    const raw = new Float32Array(10); // all zeros
    const variance: [number, number] = [0.1, 0.2];

    const landmarks = decodeLandmarks(raw, priors, variance);

    for (let p = 0; p < 5; p++) {
      expect(landmarks[p * 2]).toBeCloseTo(0.5, 6);
      expect(landmarks[p * 2 + 1]).toBeCloseTo(0.5, 6);
    }
  });
});

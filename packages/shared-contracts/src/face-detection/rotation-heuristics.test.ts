import { describe, it, expect } from "vitest";
import {
  estimateOrientationFromSingleFace,
  estimateRotationFromFaceLandmarks,
  validateRotationWithFaceLandmarks,
} from "./rotation-heuristics";

function uprightFace(): [number, number][] {
  // Eyes above nose — standard upright face
  return [
    [40, 30],  // left eye
    [60, 30],  // right eye
    [50, 60],  // nose (below eyes)
    [42, 80],  // left mouth
    [58, 80],  // right mouth
  ];
}

function rotated180Face(): [number, number][] {
  // Eyes below nose — upside down
  return [
    [40, 70],  // left eye
    [60, 70],  // right eye
    [50, 40],  // nose (above eyes)
    [42, 20],  // left mouth
    [58, 20],  // right mouth
  ];
}

function rotated90cwFace(): [number, number][] {
  // Nose is to the LEFT of eye midpoint → rotated 90° CW
  return [
    [50, 40],  // left eye
    [50, 60],  // right eye
    [20, 50],  // nose (to the left)
    [10, 42],  // left mouth
    [10, 58],  // right mouth
  ];
}

function rotated270cwFace(): [number, number][] {
  // Nose is to the RIGHT of eye midpoint → rotated 270° CW
  return [
    [50, 40],  // left eye
    [50, 60],  // right eye
    [80, 50],  // nose (to the right)
    [90, 42],  // left mouth
    [90, 58],  // right mouth
  ];
}

describe("estimateOrientationFromSingleFace", () => {
  it("detects upright face", () => {
    const result = estimateOrientationFromSingleFace(uprightFace(), 0.9);
    expect(result).not.toBeNull();
    expect(result!.orientation).toBe("upright");
    expect(result!.correctionAngleClockwise).toBe(0);
    expect(result!.confidence).toBeGreaterThan(0);
  });

  it("detects 180-degree rotated face", () => {
    const result = estimateOrientationFromSingleFace(rotated180Face(), 0.9);
    expect(result).not.toBeNull();
    expect(result!.orientation).toBe("rotated_180");
    expect(result!.correctionAngleClockwise).toBe(180);
  });

  it("detects 90-degree CW rotated face", () => {
    const result = estimateOrientationFromSingleFace(rotated90cwFace(), 0.9);
    expect(result).not.toBeNull();
    expect(result!.orientation).toBe("rotated_90_cw");
    expect(result!.correctionAngleClockwise).toBe(270);
  });

  it("detects 270-degree CW rotated face", () => {
    const result = estimateOrientationFromSingleFace(rotated270cwFace(), 0.9);
    expect(result).not.toBeNull();
    expect(result!.orientation).toBe("rotated_270_cw");
    expect(result!.correctionAngleClockwise).toBe(90);
  });

  it("returns null for too few landmarks", () => {
    expect(estimateOrientationFromSingleFace([[1, 2], [3, 4]], 0.9)).toBeNull();
  });

  it("returns null for ambiguous landmarks (nose near eye midpoint)", () => {
    const ambiguous: [number, number][] = [
      [50, 50], [50, 50], [50, 50], [50, 50], [50, 50],
    ];
    expect(estimateOrientationFromSingleFace(ambiguous, 0.9)).toBeNull();
  });

  it("returns null for non-array input", () => {
    expect(estimateOrientationFromSingleFace(null as unknown as [number, number][], 0.9)).toBeNull();
  });

  it("scales confidence with detection score", () => {
    const highScore = estimateOrientationFromSingleFace(uprightFace(), 1.0);
    const lowScore = estimateOrientationFromSingleFace(uprightFace(), 0.3);
    expect(highScore!.confidence).toBeGreaterThan(lowScore!.confidence);
  });
});

describe("estimateRotationFromFaceLandmarks", () => {
  it("aggregates unanimous upright votes", () => {
    const result = estimateRotationFromFaceLandmarks([
      { landmarks: uprightFace(), score: 0.9 },
      { landmarks: uprightFace(), score: 0.85 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.orientation).toBe("upright");
    expect(result!.unanimousAgreement).toBe(true);
    expect(result!.faceCount).toBe(2);
  });

  it("returns null for empty input", () => {
    expect(estimateRotationFromFaceLandmarks([])).toBeNull();
  });

  it("returns the majority orientation when faces disagree", () => {
    const result = estimateRotationFromFaceLandmarks([
      { landmarks: uprightFace(), score: 0.9 },
      { landmarks: uprightFace(), score: 0.9 },
      { landmarks: rotated180Face(), score: 0.5 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.orientation).toBe("upright");
    expect(result!.unanimousAgreement).toBe(false);
  });

  it("boosts confidence for unanimous multi-face agreement", () => {
    const single = estimateRotationFromFaceLandmarks([
      { landmarks: uprightFace(), score: 0.9 },
    ]);
    const multi = estimateRotationFromFaceLandmarks([
      { landmarks: uprightFace(), score: 0.9 },
      { landmarks: uprightFace(), score: 0.9 },
    ]);
    expect(multi!.confidence).toBeGreaterThanOrEqual(single!.confidence);
  });
});

describe("validateRotationWithFaceLandmarks", () => {
  it("accepts VLM angle when faces appear upright in rotated image", () => {
    const result = validateRotationWithFaceLandmarks(90, {
      orientation: "upright",
      correctionAngleClockwise: 0,
      confidence: 0.9,
      faceCount: 1,
      unanimousAgreement: true,
    });
    expect(result.finalAngle).toBe(90);
    expect(result.source).toBe("vlm");
  });

  it("flips by 180 when faces appear upside-down in rotated image", () => {
    const result = validateRotationWithFaceLandmarks(90, {
      orientation: "rotated_180",
      correctionAngleClockwise: 180,
      confidence: 0.9,
      faceCount: 1,
      unanimousAgreement: true,
    });
    expect(result.finalAngle).toBe(270);
    expect(result.source).toBe("face-corrected");
  });

  it("falls back to VLM for lateral rotations", () => {
    const result = validateRotationWithFaceLandmarks(90, {
      orientation: "rotated_90_cw",
      correctionAngleClockwise: 270,
      confidence: 0.9,
      faceCount: 1,
      unanimousAgreement: true,
    });
    expect(result.finalAngle).toBe(90);
    expect(result.source).toBe("vlm");
  });
});

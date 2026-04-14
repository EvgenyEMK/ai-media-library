import { describe, it, expect } from "vitest";
import {
  clampNormalized,
  detectBoundingBoxFormat,
  buildCanonicalBoundingBox,
  buildProviderRawBoundingBoxReference,
  fromXyxyPixelBox,
} from "./bounding-box";

describe("clampNormalized", () => {
  it("clamps to 0..1000 range", () => {
    expect(clampNormalized(500)).toBe(500);
    expect(clampNormalized(-10)).toBe(0);
    expect(clampNormalized(1500)).toBe(1000);
  });

  it("rounds to nearest integer", () => {
    expect(clampNormalized(123.7)).toBe(124);
    expect(clampNormalized(123.2)).toBe(123);
  });

  it("returns 0 for non-finite values", () => {
    expect(clampNormalized(NaN)).toBe(0);
    expect(clampNormalized(Infinity)).toBe(0);
    expect(clampNormalized(-Infinity)).toBe(0);
  });
});

describe("detectBoundingBoxFormat", () => {
  it("returns 'pixel' when mp_ fields are present", () => {
    expect(detectBoundingBoxFormat({ mp_x: 10, mp_y: 20 })).toBe("pixel");
    expect(detectBoundingBoxFormat({ mp_width: 100 })).toBe("pixel");
  });

  it("returns 'normalized' when x_min/y_min fields are present", () => {
    expect(detectBoundingBoxFormat({ x_min: 100, y_min: 200 })).toBe("normalized");
  });

  it("returns 'unknown' when no recognizable fields", () => {
    expect(detectBoundingBoxFormat({})).toBe("unknown");
    expect(detectBoundingBoxFormat({ x: 10, y: 20 })).toBe("unknown");
  });

  it("prefers pixel format over normalized when both present", () => {
    expect(
      detectBoundingBoxFormat({ mp_x: 10, x_min: 100 }),
    ).toBe("pixel");
  });
});

describe("buildCanonicalBoundingBox", () => {
  it("converts pixel coordinates with image dimensions to normalized", () => {
    const box = buildCanonicalBoundingBox({
      mp_x: 100,
      mp_y: 200,
      mp_width: 50,
      mp_height: 80,
      image_width: 1000,
      image_height: 1000,
    });

    expect(box.x_min).toBe(100);
    expect(box.y_min).toBe(200);
    expect(box.x_max).toBe(150);
    expect(box.y_max).toBe(280);
    expect(box.image_width).toBe(1000);
    expect(box.image_height).toBe(1000);
  });

  it("preserves already-normalized coordinates", () => {
    const box = buildCanonicalBoundingBox({
      x_min: 100,
      y_min: 200,
      x_max: 300,
      y_max: 400,
    });

    expect(box.x_min).toBe(100);
    expect(box.y_min).toBe(200);
    expect(box.x_max).toBe(300);
    expect(box.y_max).toBe(400);
  });

  it("computes pixel fields when image dimensions are available", () => {
    const box = buildCanonicalBoundingBox({
      x_min: 100,
      y_min: 200,
      x_max: 300,
      y_max: 400,
      image_width: 500,
      image_height: 500,
    });

    expect(box.x).toBeCloseTo(50);
    expect(box.y).toBeCloseTo(100);
    expect(box.width).toBeCloseTo(100);
    expect(box.height).toBeCloseTo(100);
  });

  it("handles zero-area box gracefully", () => {
    const box = buildCanonicalBoundingBox({
      mp_x: 0,
      mp_y: 0,
      mp_width: 0,
      mp_height: 0,
      image_width: 1000,
      image_height: 1000,
    });

    expect(box.x_min).toBe(0);
    expect(box.y_min).toBe(0);
    expect(box.x_max).toBeGreaterThanOrEqual(0);
    expect(box.y_max).toBeGreaterThanOrEqual(0);
  });
});

describe("buildProviderRawBoundingBoxReference", () => {
  it("returns null when providerId is undefined", () => {
    expect(buildProviderRawBoundingBoxReference(undefined, { mp_x: 10 })).toBeNull();
  });

  it("builds reference with auto-detected format", () => {
    const ref = buildProviderRawBoundingBoxReference("azure-face", {
      mp_x: 10,
      mp_y: 20,
      mp_width: 50,
      mp_height: 60,
    });

    expect(ref).not.toBeNull();
    expect(ref!.provider_id).toBe("azure-face");
    expect(ref!.format).toBe("pixel");
  });

  it("uses explicit format when provided", () => {
    const ref = buildProviderRawBoundingBoxReference(
      "custom",
      { x: 10, y: 20 },
      "normalized",
    );

    expect(ref!.format).toBe("normalized");
  });
});

describe("fromXyxyPixelBox", () => {
  it("converts [x1,y1,x2,y2] tuple to canonical box", () => {
    const box = fromXyxyPixelBox([100, 200, 300, 400], { width: 1000, height: 1000 });

    expect(box.x_min).toBeDefined();
    expect(box.y_min).toBeDefined();
    expect(box.x_max).toBeDefined();
    expect(box.y_max).toBeDefined();
    expect(box.image_width).toBe(1000);
    expect(box.image_height).toBe(1000);
    expect(box.x_max!).toBeGreaterThan(box.x_min!);
    expect(box.y_max!).toBeGreaterThan(box.y_min!);
  });

  it("works without image size", () => {
    const box = fromXyxyPixelBox([10, 20, 30, 40]);

    expect(box.x_min).toBeDefined();
    expect(box.y_min).toBeDefined();
  });

  it("handles inverted coordinates (x2 < x1)", () => {
    const box = fromXyxyPixelBox([300, 400, 100, 200], { width: 1000, height: 1000 });
    expect(box.x_min).toBeDefined();
    expect(box.y_min).toBeDefined();
  });
});

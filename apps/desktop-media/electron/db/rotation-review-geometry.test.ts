import { describe, expect, it } from "vitest";
import {
  mapAabbQuarterTurn,
  rotateDimensionsQuarterTurn,
} from "./rotation-review-geometry";
import { mapMetadataBoundingBoxQuarterTurn } from "./rotation-review-metadata-geometry";

describe("mapAabbQuarterTurn", () => {
  const ref = { width: 400, height: 300 };
  const box = { x: 40, y: 60, width: 80, height: 50 };

  it("maps a box through a 90 degree clockwise turn", () => {
    expect(mapAabbQuarterTurn(box, ref, 90)).toEqual({
      box: { x: 190, y: 40, width: 50, height: 80 },
      ref: { width: 300, height: 400 },
    });
  });

  it("maps a box through a 180 degree turn", () => {
    expect(mapAabbQuarterTurn(box, ref, 180)).toEqual({
      box: { x: 280, y: 190, width: 80, height: 50 },
      ref,
    });
  });

  it("maps a box through a 270 degree clockwise turn", () => {
    expect(mapAabbQuarterTurn(box, ref, 270)).toEqual({
      box: { x: 60, y: 280, width: 50, height: 80 },
      ref: { width: 300, height: 400 },
    });
  });

  it("clamps boxes to their source reference before mapping", () => {
    expect(
      mapAabbQuarterTurn({ x: -10, y: 250, width: 60, height: 80 }, ref, 90),
    ).toEqual({
      box: { x: 0, y: 0, width: 50, height: 50 },
      ref: { width: 300, height: 400 },
    });
  });

  it("rotates image dimensions for quarter turns", () => {
    expect(rotateDimensionsQuarterTurn(ref, 90)).toEqual({ width: 300, height: 400 });
    expect(rotateDimensionsQuarterTurn(ref, 180)).toEqual(ref);
  });

  it("maps metadata pixel box fields and updates their reference size", () => {
    expect(
      mapMetadataBoundingBoxQuarterTurn(
        { x: 40, y: 60, width: 80, height: 50, image_width: 400, image_height: 300 },
        ref,
        90,
      ),
    ).toEqual({
      x: 190,
      y: 40,
      width: 50,
      height: 80,
      image_width: 300,
      image_height: 400,
    });
  });

  it("maps normalized metadata fields because they take overlay precedence", () => {
    expect(
      mapMetadataBoundingBoxQuarterTurn(
        { x_min: 100, y_min: 200, x_max: 300, y_max: 500 },
        NORMALIZED_TEST_REF,
        270,
      ),
    ).toEqual({
      x_min: 200,
      y_min: 700,
      x_max: 500,
      y_max: 900,
    });
  });
});

const NORMALIZED_TEST_REF = { width: 1000, height: 1000 };

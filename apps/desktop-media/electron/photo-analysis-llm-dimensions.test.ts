import { describe, expect, it } from "vitest";
import { computeDownscaledPixelDimensionsForLlm } from "./photo-analysis";

describe("computeDownscaledPixelDimensionsForLlm", () => {
  it("returns null when longest side already fits", () => {
    expect(computeDownscaledPixelDimensionsForLlm(800, 600, 1024)).toBeNull();
    expect(computeDownscaledPixelDimensionsForLlm(1024, 1024, 1024)).toBeNull();
  });

  it("scales landscape 4:3 to fit longest edge", () => {
    expect(computeDownscaledPixelDimensionsForLlm(4000, 3000, 1024)).toEqual({
      width: 1024,
      height: 768,
    });
  });

  it("scales portrait to fit longest edge", () => {
    expect(computeDownscaledPixelDimensionsForLlm(3000, 4000, 1024)).toEqual({
      width: 768,
      height: 1024,
    });
  });

  it("handles square images", () => {
    expect(computeDownscaledPixelDimensionsForLlm(2000, 2000, 1024)).toEqual({
      width: 1024,
      height: 1024,
    });
  });
});

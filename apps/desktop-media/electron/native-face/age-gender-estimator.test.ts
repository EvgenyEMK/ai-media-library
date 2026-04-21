import { describe, expect, it } from "vitest";
import { interpretAgeGenderLogits } from "./age-gender-estimator";

describe("interpretAgeGenderLogits", () => {
  it("rounds age and clamps to [0, 100]", () => {
    const midFemale = interpretAgeGenderLogits([37.49, 0.9]);
    expect(midFemale.ageYears).toBe(37);
    expect(midFemale.gender).toBe("female");
    expect(midFemale.genderConfidence).toBeCloseTo(0.9, 5);

    const midMale = interpretAgeGenderLogits([42.51, 0.12]);
    expect(midMale.ageYears).toBe(43);
    expect(midMale.gender).toBe("male");
    expect(midMale.genderConfidence).toBeCloseTo(0.88, 5);
  });

  it("clamps negative ages to 0 and large ages to 100", () => {
    expect(interpretAgeGenderLogits([-5, 0.1]).ageYears).toBe(0);
    expect(interpretAgeGenderLogits([250, 0.9]).ageYears).toBe(100);
  });

  it("treats gender >= 0.5 as female and < 0.5 as male", () => {
    expect(interpretAgeGenderLogits([30, 0.5]).gender).toBe("female");
    expect(interpretAgeGenderLogits([30, 0.499]).gender).toBe("male");
  });

  it("throws when logits length is less than 2", () => {
    expect(() => interpretAgeGenderLogits([])).toThrow(/expected >=2/);
    expect(() => interpretAgeGenderLogits([25])).toThrow(/expected >=2/);
  });
});

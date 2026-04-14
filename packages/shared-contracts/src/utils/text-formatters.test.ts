import { describe, it, expect } from "vitest";
import { toHeadlineLabel, getCategoryLabel, getGenderLabel } from "./text-formatters";

describe("toHeadlineLabel", () => {
  it("converts underscored string to headline case", () => {
    expect(toHeadlineLabel("white_balance_fix")).toBe("White Balance Fix");
  });

  it("handles single word", () => {
    expect(toHeadlineLabel("nature")).toBe("Nature");
  });

  it("handles empty string", () => {
    expect(toHeadlineLabel("")).toBe("");
  });

  it("strips leading/trailing underscores", () => {
    expect(toHeadlineLabel("_hello_world_")).toBe("Hello World");
  });

  it("handles consecutive underscores", () => {
    expect(toHeadlineLabel("hello__world")).toBe("Hello World");
  });
});

describe("getCategoryLabel", () => {
  it("maps known categories", () => {
    expect(getCategoryLabel("adult")).toBe("Adult");
    expect(getCategoryLabel("child")).toBe("Child");
    expect(getCategoryLabel("baby")).toBe("Baby");
  });

  it("is case-insensitive", () => {
    expect(getCategoryLabel("ADULT")).toBe("Adult");
    expect(getCategoryLabel("Child")).toBe("Child");
  });

  it("returns null for null/undefined/empty", () => {
    expect(getCategoryLabel(null)).toBeNull();
    expect(getCategoryLabel(undefined)).toBeNull();
    expect(getCategoryLabel("")).toBeNull();
  });

  it("passes through unknown categories", () => {
    expect(getCategoryLabel("teenager")).toBe("teenager");
  });
});

describe("getGenderLabel", () => {
  it("maps known genders", () => {
    expect(getGenderLabel("male")).toBe("Male");
    expect(getGenderLabel("female")).toBe("Female");
    expect(getGenderLabel("unknown")).toBe("Unknown");
    expect(getGenderLabel("other")).toBe("Other");
  });

  it("is case-insensitive", () => {
    expect(getGenderLabel("MALE")).toBe("Male");
    expect(getGenderLabel("Female")).toBe("Female");
  });

  it("returns null for null/undefined/empty", () => {
    expect(getGenderLabel(null)).toBeNull();
    expect(getGenderLabel(undefined)).toBeNull();
    expect(getGenderLabel("")).toBeNull();
  });

  it("passes through unknown values", () => {
    expect(getGenderLabel("non-binary")).toBe("non-binary");
  });
});

import { describe, expect, it } from "vitest";
import type { FolderFaceMainSubjectHistogram } from "../../shared/ipc";
import { summarizeMainSubjectsBuckets } from "./main-subject-histogram-buckets";

function hist(overrides: Partial<FolderFaceMainSubjectHistogram> = {}): FolderFaceMainSubjectHistogram {
  return {
    oneMainSubject: 0,
    twoMainSubjects: 0,
    threeMainSubjects: 0,
    fourMainSubjects: 0,
    fiveOrMoreMainSubjects: 0,
    ...overrides,
  };
}

describe("summarizeMainSubjectsBuckets", () => {
  it("maps histogram buckets to one, two, threeExact, and fourPlus", () => {
    expect(
      summarizeMainSubjectsBuckets(
        hist({
          oneMainSubject: 10,
          twoMainSubjects: 5,
          threeMainSubjects: 2,
          fourMainSubjects: 1,
          fiveOrMoreMainSubjects: 7,
        }),
      ),
    ).toEqual({
      one: 10,
      two: 5,
      threeExact: 2,
      fourPlus: 8,
    });
  });

  it("returns zeros when histogram is empty", () => {
    expect(summarizeMainSubjectsBuckets(hist())).toEqual({
      one: 0,
      two: 0,
      threeExact: 0,
      fourPlus: 0,
    });
  });
});

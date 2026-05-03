import type { FolderFaceMainSubjectHistogram } from "../../shared/ipc";

export interface MainSubjectPeopleBuckets {
  one: number;
  two: number;
  /** Images whose main-subject count is exactly three. */
  threeExact: number;
  /** Images with four or more main subjects (four + five-or-more buckets). */
  fourPlus: number;
}

export function summarizeMainSubjectsBuckets(histogram: FolderFaceMainSubjectHistogram): MainSubjectPeopleBuckets {
  return {
    one: histogram.oneMainSubject,
    two: histogram.twoMainSubjects,
    threeExact: histogram.threeMainSubjects,
    fourPlus: histogram.fourMainSubjects + histogram.fiveOrMoreMainSubjects,
  };
}

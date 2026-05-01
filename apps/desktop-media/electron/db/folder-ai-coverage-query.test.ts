import { beforeEach, describe, expect, it, vi } from "vitest";

const getCalls: { sql: string; args: unknown[] }[] = [];
let nextRow = {
  total: 5,
  photo_done: 4,
  face_done: 3,
  semantic_done: 2,
  rotation_done: 1,
  rotation_wrong: 1,
  rotation_failed: 2,
  photo_failed: 0,
  face_failed: 0,
  semantic_failed: 0,
};

const mockDb = {
  prepare: (sql: string) => ({
    get: (...args: unknown[]) => {
      getCalls.push({ sql, args });
      return nextRow;
    },
  }),
};

vi.mock("./client", () => ({
  getDesktopDatabase: () => mockDb,
}));

vi.mock("./folder-analysis-status", () => ({
  DEFAULT_LIBRARY_ID: "local-default",
}));

vi.mock("./folder-geo-coverage", () => ({
  getFolderGeoCoverage: () => ({
    images: { total: 5, withGpsCount: 0, withoutGpsCount: 5, locationDetailsDoneCount: 0 },
    videos: { total: 0, withGpsCount: 0, withoutGpsCount: 0, locationDetailsDoneCount: 0 },
    locationDetails: { doneCount: 0, totalWithGps: 0, label: "empty" },
  }),
}));

import { getFolderAiCoverage } from "./folder-ai-coverage";

describe("getFolderAiCoverage", () => {
  beforeEach(() => {
    getCalls.length = 0;
    nextRow = {
      total: 5,
      photo_done: 4,
      face_done: 3,
      semantic_done: 2,
      rotation_done: 1,
      rotation_wrong: 1,
      rotation_failed: 2,
      photo_failed: 0,
      face_failed: 0,
      semantic_failed: 0,
    };
  });

  it("aggregates image rotation detection from ai_metadata", () => {
    const coverage = getFolderAiCoverage({ folderPath: "C:\\photos", recursive: true });

    expect(coverage.rotation).toEqual({
      doneCount: 1,
      failedCount: 2,
      totalImages: 5,
      label: "partial",
      issueCount: 1,
    });
    expect(getCalls[0]?.sql).toContain("$.orientation_detection");
    expect(getCalls[0]?.sql).toContain("$.orientation_detection_error");
    expect(getCalls[0]?.sql).toContain("correction_angle_clockwise");
  });

  it("counts a later face-detection failure even when an older processed timestamp exists", () => {
    nextRow = {
      total: 5,
      photo_done: 4,
      face_done: 2,
      semantic_done: 2,
      rotation_done: 1,
      rotation_wrong: 1,
      rotation_failed: 2,
      photo_failed: 0,
      face_failed: 1,
      semantic_failed: 0,
    };

    const coverage = getFolderAiCoverage({ folderPath: "C:\\photos", recursive: true });

    expect(coverage.face).toEqual({
      doneCount: 2,
      failedCount: 1,
      totalImages: 5,
      label: "partial",
      imagesWithFacesCount: 0,
      imagesWithTaggedFacesCount: 0,
    });
    expect(getCalls[0]?.sql).toContain("mi.face_detection_failed_at >= mi.face_detection_processed_at");
    expect(getCalls[0]?.sql).toContain("mi.face_detection_processed_at > mi.face_detection_failed_at");
  });
});

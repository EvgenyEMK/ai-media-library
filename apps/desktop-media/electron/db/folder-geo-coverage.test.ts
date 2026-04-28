import { beforeEach, describe, expect, it, vi } from "vitest";

let nextRow = {
  image_total: 0,
  image_with_gps: 0,
  video_total: 0,
  video_with_gps: 0,
  image_location_details_done: 0,
  video_location_details_done: 0,
  location_details_done: 0,
};
const getCalls: { sql: string; args: unknown[] }[] = [];

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

import { getFolderGeoCoverage, toLocationDetailsCoverage } from "./folder-geo-coverage";

describe("folder geo coverage", () => {
  beforeEach(() => {
    getCalls.length = 0;
    nextRow = {
      image_total: 0,
      image_with_gps: 0,
      video_total: 0,
      video_with_gps: 0,
      image_location_details_done: 0,
      video_location_details_done: 0,
      location_details_done: 0,
    };
  });

  it("aggregates image and video GPS coverage", () => {
    nextRow = {
      image_total: 10,
      image_with_gps: 7,
      image_location_details_done: 5,
      video_total: 4,
      video_with_gps: 1,
      video_location_details_done: 1,
      location_details_done: 6,
    };

    const coverage = getFolderGeoCoverage({ folderPath: "C:\\photos", recursive: true });

    expect(coverage.images).toEqual({
      total: 10,
      withGpsCount: 7,
      withoutGpsCount: 3,
      locationDetailsDoneCount: 5,
    });
    expect(coverage.videos).toEqual({
      total: 4,
      withGpsCount: 1,
      withoutGpsCount: 3,
      locationDetailsDoneCount: 1,
    });
    expect(coverage.locationDetails).toEqual({ doneCount: 6, totalWithGps: 8, label: "partial" });
    expect(getCalls[0]?.args).toEqual(["local-default", "C:\\photos\\%"]);
  });

  it("adds direct-folder depth bindings for non-recursive coverage", () => {
    getFolderGeoCoverage({ folderPath: "C:\\photos", recursive: false, libraryId: "library-a" });

    expect(getCalls[0]?.args).toEqual(["library-a", "C:\\photos\\%", "C:\\photos\\", "\\"]);
    expect(getCalls[0]?.sql).toContain("instr(substr(mi.source_path");
  });

  it("labels location detail extraction as empty, not done, partial, or done", () => {
    expect(toLocationDetailsCoverage(0, 0).label).toBe("empty");
    expect(toLocationDetailsCoverage(0, 3).label).toBe("not_done");
    expect(toLocationDetailsCoverage(1, 3).label).toBe("partial");
    expect(toLocationDetailsCoverage(3, 3).label).toBe("done");
  });
});

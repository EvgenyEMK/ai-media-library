import { describe, expect, it } from "vitest";
import {
  collectDuplicateDeleteTargetsForColumn,
  countDistinctParentFolders,
  sumByteSizesForPaths,
} from "./duplicate-files-marked-delete-aggregate";
import type { FolderDuplicateScanRow } from "../../shared/ipc";

const rows: FolderDuplicateScanRow[] = [
  {
    scopedPath: "/a/one.jpg",
    mediaItemId: "m1",
    byteSize: 10,
    fileMtimeMs: null,
    photoTakenAt: null,
    photoTakenPrecision: null,
    mediaKind: "image",
    duplicates: [
      {
        mediaItemId: "d1",
        sourcePath: "/b/dup.jpg",
        byteSize: 20,
        fileMtimeMs: null,
        photoTakenAt: null,
        photoTakenPrecision: null,
      },
    ],
  },
];

describe("duplicate-files-marked-delete-aggregate", () => {
  it("collects scoped targets from marks", () => {
    const marks = new Set(["scoped:m1"]);
    const t = collectDuplicateDeleteTargetsForColumn(rows, marks, "scoped");
    expect(t).toEqual([{ mediaItemId: "m1", sourcePath: "/a/one.jpg" }]);
  });

  it("collects dup targets from marks", () => {
    const marks = new Set(["dup:d1"]);
    const t = collectDuplicateDeleteTargetsForColumn(rows, marks, "dup");
    expect(t).toEqual([{ mediaItemId: "d1", sourcePath: "/b/dup.jpg" }]);
  });

  it("countDistinctParentFolders counts unique parents", () => {
    expect(countDistinctParentFolders(["/a/x.jpg", "/a/y.jpg", "/b/z.jpg"])).toBe(2);
  });

  it("sumByteSizesForPaths sums from row data", () => {
    const targets = [
      { mediaItemId: "m1", sourcePath: "/a/one.jpg" },
      { mediaItemId: "d1", sourcePath: "/b/dup.jpg" },
    ];
    expect(sumByteSizesForPaths(rows, targets)).toBe(30);
  });
});

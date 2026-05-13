import { describe, it, expect } from "vitest";
import path from "node:path";
import type { FolderDuplicateScanResultPayload } from "../../shared/ipc";
import {
  countScopedFilesWithDuplicateInsideDiskTree,
  countScopedFilesWithDuplicateOutsideDiskTree,
  totalByteSizeOfDuplicatesInsideDiskTree,
  totalByteSizeOfDuplicatesOutsideDiskTree,
} from "./duplicate-files-outside-selection-stats";

function payloadFrom(rows: FolderDuplicateScanResultPayload["rows"], folderPath: string): FolderDuplicateScanResultPayload {
  return {
    folderPath,
    recursive: true,
    rows,
    skippedMissingContentHashCount: 0,
    skippedLargeFileCount: 0,
    skippedMissingOnDiskCount: 0,
  };
}

describe("duplicate-files-outside-selection-stats", () => {
  it("counts scoped rows with any duplicate outside selection disk tree", () => {
    const root = path.normalize("/scan/Camera");
    const payload = payloadFrom(
      [
        {
          scopedPath: path.normalize("/scan/Camera/x.jpg"),
          mediaItemId: "1",
          byteSize: 1,
          fileMtimeMs: 1,
          photoTakenAt: null,
          photoTakenPrecision: null,
          mediaKind: "image",
          duplicates: [
            {
              mediaItemId: "d1",
              sourcePath: path.normalize("/library/a.jpg"),
              byteSize: 100,
              fileMtimeMs: 1,
              photoTakenAt: null,
              photoTakenPrecision: null,
            },
            {
              mediaItemId: "d2",
              sourcePath: path.normalize("/scan/Camera/sub/b.jpg"),
              byteSize: 200,
              fileMtimeMs: 1,
              photoTakenAt: null,
              photoTakenPrecision: null,
            },
          ],
        },
        {
          scopedPath: path.normalize("/scan/Camera/y.jpg"),
          mediaItemId: "2",
          byteSize: 1,
          fileMtimeMs: 1,
          photoTakenAt: null,
          photoTakenPrecision: null,
          mediaKind: "image",
          duplicates: [
            {
              mediaItemId: "d3",
              sourcePath: path.normalize("/scan/Camera/sub/c.jpg"),
              byteSize: 50,
              fileMtimeMs: 1,
              photoTakenAt: null,
              photoTakenPrecision: null,
            },
          ],
        },
      ],
      root,
    );
    expect(countScopedFilesWithDuplicateOutsideDiskTree(payload)).toBe(1);
  });

  it("sums byte sizes of distinct duplicate paths outside tree once", () => {
    const root = path.normalize("/scan/Camera");
    const libPath = path.normalize("/lib/x.jpg");
    const payload = payloadFrom(
      [
        {
          scopedPath: path.normalize("/scan/Camera/a.jpg"),
          mediaItemId: "1",
          byteSize: 1,
          fileMtimeMs: 1,
          photoTakenAt: null,
          photoTakenPrecision: null,
          mediaKind: "image",
          duplicates: [
            {
              mediaItemId: "d1",
              sourcePath: libPath,
              byteSize: 1_000_000,
              fileMtimeMs: 1,
              photoTakenAt: null,
              photoTakenPrecision: null,
            },
          ],
        },
        {
          scopedPath: path.normalize("/scan/Camera/b.jpg"),
          mediaItemId: "2",
          byteSize: 1,
          fileMtimeMs: 1,
          photoTakenAt: null,
          photoTakenPrecision: null,
          mediaKind: "image",
          duplicates: [
            {
              mediaItemId: "d2",
              sourcePath: libPath,
              byteSize: 2_000_000,
              fileMtimeMs: 1,
              photoTakenAt: null,
              photoTakenPrecision: null,
            },
          ],
        },
      ],
      root,
    );
    expect(totalByteSizeOfDuplicatesOutsideDiskTree(payload)).toBe(1_000_000);
  });

  it("counts scoped rows with any duplicate inside selection disk tree", () => {
    const root = path.normalize("/scan/Camera");
    const payload = payloadFrom(
      [
        {
          scopedPath: path.normalize("/scan/Camera/x.jpg"),
          mediaItemId: "1",
          byteSize: 1,
          fileMtimeMs: 1,
          photoTakenAt: null,
          photoTakenPrecision: null,
          mediaKind: "image",
          duplicates: [
            {
              mediaItemId: "d1",
              sourcePath: path.normalize("/library/a.jpg"),
              byteSize: 100,
              fileMtimeMs: 1,
              photoTakenAt: null,
              photoTakenPrecision: null,
            },
          ],
        },
        {
          scopedPath: path.normalize("/scan/Camera/y.jpg"),
          mediaItemId: "2",
          byteSize: 1,
          fileMtimeMs: 1,
          photoTakenAt: null,
          photoTakenPrecision: null,
          mediaKind: "image",
          duplicates: [
            {
              mediaItemId: "d2",
              sourcePath: path.normalize("/scan/Camera/sub/c.jpg"),
              byteSize: 50,
              fileMtimeMs: 1,
              photoTakenAt: null,
              photoTakenPrecision: null,
            },
          ],
        },
      ],
      root,
    );
    expect(countScopedFilesWithDuplicateInsideDiskTree(payload)).toBe(1);
  });

  it("sums byte sizes of distinct duplicate paths inside tree once", () => {
    const root = path.normalize("/scan/Camera");
    const innerPath = path.normalize("/scan/Camera/sub/x.jpg");
    const payload = payloadFrom(
      [
        {
          scopedPath: path.normalize("/scan/Camera/a.jpg"),
          mediaItemId: "1",
          byteSize: 1,
          fileMtimeMs: 1,
          photoTakenAt: null,
          photoTakenPrecision: null,
          mediaKind: "image",
          duplicates: [
            {
              mediaItemId: "d1",
              sourcePath: innerPath,
              byteSize: 3_000_000,
              fileMtimeMs: 1,
              photoTakenAt: null,
              photoTakenPrecision: null,
            },
          ],
        },
        {
          scopedPath: path.normalize("/scan/Camera/b.jpg"),
          mediaItemId: "2",
          byteSize: 1,
          fileMtimeMs: 1,
          photoTakenAt: null,
          photoTakenPrecision: null,
          mediaKind: "image",
          duplicates: [
            {
              mediaItemId: "d2",
              sourcePath: innerPath,
              byteSize: 9_000_000,
              fileMtimeMs: 1,
              photoTakenAt: null,
              photoTakenPrecision: null,
            },
          ],
        },
      ],
      root,
    );
    expect(totalByteSizeOfDuplicatesInsideDiskTree(payload)).toBe(3_000_000);
  });
});

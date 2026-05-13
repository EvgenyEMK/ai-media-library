import { describe, expect, it } from "vitest";
import type { FolderDuplicateScanResultPayload } from "../../../src/shared/ipc";
import { filterDuplicateScanPayloadAfterMediaDeleted } from "./duplicate-files-session-after-delete";

function samplePayload(): FolderDuplicateScanResultPayload {
  return {
    folderPath: "/lib/photos",
    recursive: true,
    rows: [
      {
        scopedPath: "/lib/photos/a.jpg",
        mediaItemId: "scoped-1",
        byteSize: 100,
        fileMtimeMs: null,
        photoTakenAt: null,
        photoTakenPrecision: null,
        mediaKind: "image",
        duplicates: [
          {
            mediaItemId: "dup-1",
            sourcePath: "/lib/other/a.jpg",
            byteSize: 100,
            fileMtimeMs: null,
            photoTakenAt: null,
            photoTakenPrecision: null,
          },
        ],
      },
    ],
    skippedMissingContentHashCount: 0,
    skippedLargeFileCount: 0,
    skippedMissingOnDiskCount: 0,
  };
}

describe("filterDuplicateScanPayloadAfterMediaDeleted", () => {
  it("removes row when scoped item deleted", () => {
    const next = filterDuplicateScanPayloadAfterMediaDeleted(samplePayload(), ["scoped-1"]);
    expect(next.rows).toHaveLength(0);
  });

  it("removes row when last duplicate entry deleted", () => {
    const next = filterDuplicateScanPayloadAfterMediaDeleted(samplePayload(), ["dup-1"]);
    expect(next.rows).toHaveLength(0);
  });

  it("no-ops when ids empty", () => {
    const p = samplePayload();
    const next = filterDuplicateScanPayloadAfterMediaDeleted(p, []);
    expect(next).toEqual(p);
  });
});

import path from "node:path";
import { describe, it, expect } from "vitest";
import type { FolderDuplicateScanResultPayload, FolderDuplicateScanRow } from "../../shared/ipc";
import { buildDuplicateFolderSummaries, rowMatchesFolderFilter } from "./duplicate-files-folder-aggregate";
import { dedupeMutualSingletonDuplicateRowsForFolderFilter } from "./duplicate-files-symmetric-folder-drilldown-rows";
import { comparableFilePath } from "./media-metadata-lookup";

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

function dupEntry(
  id: string,
  sourcePath: string,
): FolderDuplicateScanRow["duplicates"][number] {
  return {
    mediaItemId: id,
    sourcePath,
    byteSize: 1,
    fileMtimeMs: null,
    photoTakenAt: null,
    photoTakenPrecision: null,
  };
}

describe("dedupeMutualSingletonDuplicateRowsForFolderFilter", () => {
  it("collapses A→B and B→A to one row when drilling into folder of A (matches folder summary count)", () => {
    const root = path.normalize("/library");
    const folderF = path.normalize("/library/2018/concert");
    const fileA = path.normalize(`${folderF}/a.jpg`);
    const fileB = path.normalize("/library/2019/other/b.jpg");

    const rowScopedA: FolderDuplicateScanRow = {
      scopedPath: fileA,
      mediaItemId: "scoped-a",
      byteSize: 1,
      fileMtimeMs: null,
      photoTakenAt: null,
      photoTakenPrecision: null,
      mediaKind: "image",
      duplicates: [dupEntry("dup-b", fileB)],
    };
    const rowScopedB: FolderDuplicateScanRow = {
      scopedPath: fileB,
      mediaItemId: "scoped-b",
      byteSize: 1,
      fileMtimeMs: null,
      photoTakenAt: null,
      photoTakenPrecision: null,
      mediaKind: "image",
      duplicates: [dupEntry("dup-a", fileA)],
    };

    const payload = payloadFrom([rowScopedA, rowScopedB], root);
    const summaries = buildDuplicateFolderSummaries(payload);
    const folderSummary = summaries.find(
      (s) => comparableFilePath(s.folderPath).toLowerCase() === comparableFilePath(folderF).toLowerCase(),
    );
    expect(folderSummary?.duplicatePathCount).toBe(1);

    const matched = [rowScopedA, rowScopedB].filter((r) => rowMatchesFolderFilter(r, folderF));
    expect(matched.length).toBe(2);

    const deduped = dedupeMutualSingletonDuplicateRowsForFolderFilter(matched, folderF);
    expect(deduped.length).toBe(1);
    expect(deduped[0]!.scopedPath).toBe(fileA);
    expect(deduped[0]!.duplicates[0]!.sourcePath).toBe(fileB);
  });

  it("keeps both rows when they are not a mutual singleton pair", () => {
    const folderF = path.normalize("/lib/f");
    const f1 = path.normalize(`${folderF}/a.jpg`);
    const f2 = path.normalize(`${folderF}/b.jpg`);
    const ext = path.normalize("/lib/out/x.jpg");

    const r1: FolderDuplicateScanRow = {
      scopedPath: f1,
      mediaItemId: "1",
      byteSize: 1,
      fileMtimeMs: null,
      photoTakenAt: null,
      photoTakenPrecision: null,
      mediaKind: "image",
      duplicates: [dupEntry("d1", ext)],
    };
    const r2: FolderDuplicateScanRow = {
      scopedPath: f2,
      mediaItemId: "2",
      byteSize: 1,
      fileMtimeMs: null,
      photoTakenAt: null,
      photoTakenPrecision: null,
      mediaKind: "image",
      duplicates: [dupEntry("d2", ext)],
    };

    const matched = [r1, r2].filter((r) => rowMatchesFolderFilter(r, folderF));
    const deduped = dedupeMutualSingletonDuplicateRowsForFolderFilter(matched, folderF);
    expect(deduped.length).toBe(2);
  });

  it("does not remove a row when mutual partner is absent from the filtered list", () => {
    const folderF = path.normalize("/lib/f");
    const fileA = path.normalize(`${folderF}/a.jpg`);
    const fileB = path.normalize("/lib/out/b.jpg");

    const rowScopedBOnly: FolderDuplicateScanRow = {
      scopedPath: fileB,
      mediaItemId: "scoped-b",
      byteSize: 1,
      fileMtimeMs: null,
      photoTakenAt: null,
      photoTakenPrecision: null,
      mediaKind: "image",
      duplicates: [dupEntry("dup-a", fileA)],
    };

    const deduped = dedupeMutualSingletonDuplicateRowsForFolderFilter([rowScopedBOnly], folderF);
    expect(deduped.length).toBe(1);
    expect(deduped[0]!.mediaItemId).toBe("scoped-b");
  });
});

import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  buildDuplicateFolderSummaries,
  rowMatchesFolderFilter,
  splitDuplicateFolderSummariesBySelectionDiskTree,
} from "./duplicate-files-folder-aggregate";
import { parentFolderPath } from "./duplicate-files-folder-scope";
import type { FolderDuplicateScanResultPayload } from "../../shared/ipc";

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

describe("duplicate-files-folder-aggregate", () => {
  it("buildDuplicateFolderSummaries groups duplicate paths by parent folder and sorts by count", () => {
    const root = path.normalize("/scan/Camera");
    const elsewhere = path.normalize("/library/2024/a.jpg");
    const inside = path.normalize("/scan/Camera/b.jpg");

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
              sourcePath: elsewhere,
              byteSize: 1,
              fileMtimeMs: 1,
              photoTakenAt: null,
              photoTakenPrecision: null,
            },
            {
              mediaItemId: "d2",
              sourcePath: inside,
              byteSize: 1,
              fileMtimeMs: 1,
              photoTakenAt: null,
              photoTakenPrecision: null,
            },
          ],
        },
      ],
      root,
    );

    const summaries = buildDuplicateFolderSummaries(payload);
    expect(summaries.length).toBe(2);
    const libFolder = parentFolderPath(elsewhere);
    const camFolder = parentFolderPath(inside);
    const byPath = new Map(summaries.map((s) => [s.folderPath, s]));
    expect(byPath.get(libFolder)?.outsideSelectionCount).toBe(1);
    expect(byPath.get(libFolder)?.inSelectionCount).toBe(0);
    expect(byPath.get(camFolder)?.inSelectionCount).toBe(1);
    expect(byPath.get(camFolder)?.outsideSelectionCount).toBe(0);
    expect(byPath.get(libFolder)?.duplicateBytesTotal).toBe(1);
    expect(byPath.get(camFolder)?.duplicateBytesTotal).toBe(1);
  });

  it("rowMatchesFolderFilter matches scoped row or duplicate in folder", () => {
    const f = path.normalize("/scan/Camera/sub");
    const row = {
      scopedPath: path.normalize("/scan/Camera/sub/a.jpg"),
      mediaItemId: "1",
      byteSize: 1,
      fileMtimeMs: null,
      photoTakenAt: null,
      photoTakenPrecision: null,
      mediaKind: "image" as const,
      duplicates: [
        {
          mediaItemId: "d",
          sourcePath: path.normalize("/archive/2024/z.jpg"),
          byteSize: 1,
          fileMtimeMs: null,
          photoTakenAt: null,
          photoTakenPrecision: null,
        },
      ],
    };
    expect(rowMatchesFolderFilter(row, f)).toBe(true);
    expect(rowMatchesFolderFilter(row, path.normalize("/lib"))).toBe(false);
  });

  it("splitDuplicateFolderSummariesBySelectionDiskTree puts folders under scan on disk inside", () => {
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
              byteSize: 1,
              fileMtimeMs: 1,
              photoTakenAt: null,
              photoTakenPrecision: null,
            },
            {
              mediaItemId: "d2",
              sourcePath: path.normalize("/scan/Camera/sub/b.jpg"),
              byteSize: 1,
              fileMtimeMs: 1,
              photoTakenAt: null,
              photoTakenPrecision: null,
            },
          ],
        },
      ],
      root,
    );
    const summaries = buildDuplicateFolderSummaries(payload);
    const { outside, inside } = splitDuplicateFolderSummariesBySelectionDiskTree(summaries, root);
    expect(outside.map((s) => s.folderPath)).toContain(parentFolderPath(path.normalize("/library/a.jpg")));
    expect(inside.map((s) => s.folderPath)).toContain(parentFolderPath(path.normalize("/scan/Camera/sub/b.jpg")));
    expect(outside.length + inside.length).toBe(summaries.length);
  });
});

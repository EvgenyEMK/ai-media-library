import { describe, expect, it } from "vitest";
import type { FolderAiCoverageReport, FolderFaceSummaryStreamRowSpec } from "../../shared/ipc";
import {
  FOLDER_FACE_SUMMARY_STREAM_ROW_IDS,
  folderFaceSummarySubfolderRowId,
} from "../../shared/ipc";
import { deriveFolderAiSummaryTableProps } from "./folder-ai-summary-table-props";

function mockCoverage(partial: Partial<FolderAiCoverageReport> = {}): FolderAiCoverageReport {
  const base: FolderAiCoverageReport = {
    folderPath: "/x",
    recursive: true,
    totalImages: 0,
    photo: { doneCount: 0, failedCount: 0, totalImages: 0, label: "empty" },
    face: { doneCount: 0, failedCount: 0, totalImages: 0, label: "empty" },
    semantic: { doneCount: 0, failedCount: 0, totalImages: 0, label: "empty" },
    rotation: { doneCount: 0, failedCount: 0, totalImages: 0, label: "empty", issueCount: 0 },
    geo: {
      images: { total: 0, withGpsCount: 0, withoutGpsCount: 0, locationDetailsDoneCount: 0 },
      videos: { total: 0, withGpsCount: 0, withoutGpsCount: 0, locationDetailsDoneCount: 0 },
      locationDetails: { doneCount: 0, totalWithGps: 0, label: "empty" },
    },
  };
  return { ...base, ...partial };
}

describe("deriveFolderAiSummaryTableProps", () => {
  it("single-folder layout maps coverage to selectedDirectOnly only", () => {
    const specs: FolderFaceSummaryStreamRowSpec[] = [
      {
        rowId: FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.singleFolder,
        folderPath: "/photos/a",
        name: "",
        recursive: false,
      },
    ];
    const cov = mockCoverage({ folderPath: "/photos/a", recursive: false });
    const derived = deriveFolderAiSummaryTableProps(specs, {
      [FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.singleFolder]: cov,
    });
    expect(derived.treeLayout).toBe(false);
    expect(derived.selectedWithSubfolders).toBeUndefined();
    expect(derived.selectedDirectOnly).toBe(cov);
    expect(derived.subfolders).toEqual([]);
  });

  it("tree layout splits recursive, direct, and subfolder rows", () => {
    const subPath = "/root/sub";
    const specs: FolderFaceSummaryStreamRowSpec[] = [
      {
        rowId: FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedRecursive,
        folderPath: "/root",
        name: "",
        recursive: true,
      },
      {
        rowId: FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedDirect,
        folderPath: "/root",
        name: "",
        recursive: false,
      },
      {
        rowId: folderFaceSummarySubfolderRowId(subPath),
        folderPath: subPath,
        name: "sub",
        recursive: true,
      },
    ];
    const cr = mockCoverage({ folderPath: "/root", recursive: true });
    const cd = mockCoverage({ folderPath: "/root", recursive: false });
    const cs = mockCoverage({ folderPath: subPath, recursive: true });
    const derived = deriveFolderAiSummaryTableProps(specs, {
      [FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedRecursive]: cr,
      [FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedDirect]: cd,
      [folderFaceSummarySubfolderRowId(subPath)]: cs,
    });
    expect(derived.treeLayout).toBe(true);
    expect(derived.selectedWithSubfolders).toBe(cr);
    expect(derived.selectedDirectOnly).toBe(cd);
    expect(derived.subfolders).toEqual([
      { folderPath: subPath, name: "sub", coverage: cs },
    ]);
  });
});

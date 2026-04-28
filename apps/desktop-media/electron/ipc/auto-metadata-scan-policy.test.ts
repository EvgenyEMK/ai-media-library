import { describe, expect, it } from "vitest";
import { shouldRunAutoMetadataScan } from "./auto-metadata-scan-policy";

describe("shouldRunAutoMetadataScan", () => {
  it("skips when a folder summary opens a media stream only to establish selection", () => {
    expect(
      shouldRunAutoMetadataScan({
        directMediaCount: 12,
        childFolderCount: 0,
        autoScanMaxFiles: 100,
        hasRunningManualScan: false,
        suppressAutoMetadataScan: true,
      }),
    ).toBe(false);
  });

  it("skips empty direct folders that only contain subfolders", () => {
    expect(
      shouldRunAutoMetadataScan({
        directMediaCount: 0,
        childFolderCount: 3,
        autoScanMaxFiles: 100,
        hasRunningManualScan: false,
      }),
    ).toBe(false);
  });

  it("runs for direct media below the auto-scan size limit", () => {
    expect(
      shouldRunAutoMetadataScan({
        directMediaCount: 12,
        childFolderCount: 3,
        autoScanMaxFiles: 100,
        hasRunningManualScan: false,
      }),
    ).toBe(true);
  });

  it("skips when a manual metadata scan is already running", () => {
    expect(
      shouldRunAutoMetadataScan({
        directMediaCount: 12,
        childFolderCount: 0,
        autoScanMaxFiles: 100,
        hasRunningManualScan: true,
      }),
    ).toBe(false);
  });

  it("skips direct media at or above the auto-scan size limit", () => {
    expect(
      shouldRunAutoMetadataScan({
        directMediaCount: 100,
        childFolderCount: 0,
        autoScanMaxFiles: 100,
        hasRunningManualScan: false,
      }),
    ).toBe(false);
  });
});

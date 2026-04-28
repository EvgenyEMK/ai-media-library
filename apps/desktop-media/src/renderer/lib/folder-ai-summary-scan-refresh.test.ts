import { describe, expect, it } from "vitest";
import { shouldRefreshFolderAiSummaryAfterScan } from "./folder-ai-summary-scan-refresh";

describe("shouldRefreshFolderAiSummaryAfterScan", () => {
  it("ignores metadata scans that did not change catalog or geo data", () => {
    expect(
      shouldRefreshFolderAiSummaryAfterScan("C:\\photos", {
        changed: false,
        folderPath: "C:\\photos",
        foldersTouched: ["C:\\photos"],
      }),
    ).toBe(false);
  });

  it("refreshes when a changed scan touches the visible folder subtree", () => {
    expect(
      shouldRefreshFolderAiSummaryAfterScan("C:\\photos", {
        changed: true,
        folderPath: "C:\\photos\\trip",
        foldersTouched: ["C:\\photos\\trip"],
      }),
    ).toBe(true);
  });

  it("refreshes when a changed recursive scan root contains the visible folder", () => {
    expect(
      shouldRefreshFolderAiSummaryAfterScan("C:\\photos\\trip", {
        changed: true,
        folderPath: "C:\\photos",
        foldersTouched: ["C:\\photos"],
      }),
    ).toBe(true);
  });

  it("ignores changed scans outside the visible folder", () => {
    expect(
      shouldRefreshFolderAiSummaryAfterScan("C:\\photos", {
        changed: true,
        folderPath: "D:\\archive",
        foldersTouched: ["D:\\archive"],
      }),
    ).toBe(false);
  });
});

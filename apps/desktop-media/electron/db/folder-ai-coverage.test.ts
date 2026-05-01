import { describe, expect, it } from "vitest";
import type { FolderAiCoverageReport } from "../../src/shared/ipc";
import { folderCoverageToSidebarRollup } from "./folder-ai-coverage";

function report(partial: Partial<FolderAiCoverageReport> & Pick<FolderAiCoverageReport, "totalImages">): FolderAiCoverageReport {
  const t = partial.totalImages;
  const done = (n: number) => ({
    doneCount: n,
    failedCount: 0,
    totalImages: t,
    label: n === 0 ? ("not_done" as const) : n === t ? ("done" as const) : ("partial" as const),
  });
  return {
    folderPath: partial.folderPath ?? "/x",
    recursive: partial.recursive ?? true,
    totalImages: t,
    photo: partial.photo ?? done(t),
    face: partial.face ?? done(t),
    semantic: partial.semantic ?? done(t),
    rotation: partial.rotation ?? done(t),
    geo: partial.geo ?? {
      images: { total: t, withGpsCount: 0, withoutGpsCount: t, locationDetailsDoneCount: 0 },
      videos: { total: 0, withGpsCount: 0, withoutGpsCount: 0, locationDetailsDoneCount: 0 },
      locationDetails: { doneCount: 0, totalWithGps: 0, label: "empty" },
      pathLlmLocationDetails: { doneCount: 0, totalWithoutGpsImages: t, label: t > 0 ? "not_done" : "empty" },
    },
  };
}

describe("folderCoverageToSidebarRollup", () => {
  it("returns empty when there are no images", () => {
    expect(folderCoverageToSidebarRollup(report({ totalImages: 0, photo: { doneCount: 0, failedCount: 0, totalImages: 0, label: "empty" }, face: { doneCount: 0, failedCount: 0, totalImages: 0, label: "empty" }, semantic: { doneCount: 0, failedCount: 0, totalImages: 0, label: "empty" } }))).toBe(
      "empty",
    );
  });

  it("returns all_done when every pipeline is done", () => {
    expect(folderCoverageToSidebarRollup(report({ totalImages: 5 }))).toBe("all_done");
  });

  it("returns partial when any pipeline is partial (except photo-only pending)", () => {
    const r = report({
      totalImages: 4,
      face: { doneCount: 2, failedCount: 0, totalImages: 4, label: "partial" },
    });
    expect(folderCoverageToSidebarRollup(r)).toBe("partial");
  });

  it("returns photo_analysis_waiting when face and search are done but image analysis is not", () => {
    const r = report({
      totalImages: 4,
      photo: { doneCount: 1, failedCount: 0, totalImages: 4, label: "partial" },
    });
    expect(folderCoverageToSidebarRollup(r)).toBe("photo_analysis_waiting");
  });

  it("returns photo_analysis_waiting when image analysis not started but face and search complete", () => {
    const r = report({
      totalImages: 3,
      photo: { doneCount: 0, failedCount: 0, totalImages: 3, label: "not_done" },
      face: { doneCount: 3, failedCount: 0, totalImages: 3, label: "done" },
      semantic: { doneCount: 3, failedCount: 0, totalImages: 3, label: "done" },
    });
    expect(folderCoverageToSidebarRollup(r)).toBe("photo_analysis_waiting");
  });

  it("returns not_done when a pipeline has zero done but total > 0", () => {
    const r = report({
      totalImages: 3,
      semantic: { doneCount: 0, failedCount: 0, totalImages: 3, label: "not_done" },
    });
    expect(folderCoverageToSidebarRollup(r)).toBe("not_done");
  });
});

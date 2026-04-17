import { describe, expect, it } from "vitest";
import type { FolderAiCoverageReport } from "../../shared/ipc";
import { photoPipelineMiniCardBorderClass, pipelineMiniCardBorderClass } from "./pipeline-mini-card-border";

function pipe(
  label: FolderAiCoverageReport["photo"]["label"],
  total: number,
  done: number,
  failed = 0,
): FolderAiCoverageReport["photo"] {
  return { label, totalImages: total, doneCount: done, failedCount: failed };
}

function coverage(
  photo: FolderAiCoverageReport["photo"],
  face: FolderAiCoverageReport["face"],
  semantic: FolderAiCoverageReport["semantic"],
): FolderAiCoverageReport {
  return {
    folderPath: "/test",
    recursive: false,
    totalImages: photo.totalImages,
    photo,
    face,
    semantic,
  };
}

describe("pipelineMiniCardBorderClass (semantic / face mini-cards)", () => {
  it("uses neutral border when no images", () => {
    expect(pipelineMiniCardBorderClass(pipe("empty", 0, 0))).toBe("border-[#2a3550]");
  });

  it("uses neutral border when pipeline done", () => {
    expect(pipelineMiniCardBorderClass(pipe("done", 5, 5))).toBe("border-[#2a3550]");
  });

  it("uses amber when partial with remaining work", () => {
    expect(pipelineMiniCardBorderClass(pipe("partial", 10, 3))).toBe("border-amber-400");
  });

  it("uses destructive when not started", () => {
    expect(pipelineMiniCardBorderClass(pipe("not_done", 4, 0))).toBe("border-destructive");
  });
});

describe("photoPipelineMiniCardBorderClass (image analysis mini-card + settings tint)", () => {
  const faceDone = pipe("done", 5, 5);
  const semDone = pipe("done", 5, 5);

  it("uses tint border when face and semantic done but photo not complete", () => {
    const cov = coverage(pipe("partial", 5, 2), faceDone, semDone);
    expect(photoPipelineMiniCardBorderClass(cov, "red")).toBe("border-destructive");
    expect(photoPipelineMiniCardBorderClass(cov, "amber")).toBe("border-amber-400");
    expect(photoPipelineMiniCardBorderClass(cov, "green")).toBe("border-[#2a3550]");
  });

  it("uses standard photo border when face or semantic not done", () => {
    const cov = coverage(pipe("not_done", 5, 0), pipe("not_done", 5, 0), semDone);
    expect(photoPipelineMiniCardBorderClass(cov, "green")).toBe("border-[#2a3550]");
  });

  it("uses neutral border when photo pipeline fully done", () => {
    const cov = coverage(pipe("done", 5, 5), faceDone, semDone);
    expect(photoPipelineMiniCardBorderClass(cov, "amber")).toBe("border-[#2a3550]");
  });
});

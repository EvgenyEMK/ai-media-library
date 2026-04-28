import { describe, expect, it } from "vitest";
import type { FolderAiPipelineCounts, FolderGeoMediaCoverage } from "../../../shared/ipc";
import { combinedGeoTone, mediaLocationPipeline, statusTone } from "./summary-card-formatters";

function pipeline(label: FolderAiPipelineCounts["label"], doneCount: number, totalImages: number): FolderAiPipelineCounts {
  return { label, doneCount, failedCount: 0, totalImages };
}

function geo(total: number, withGpsCount: number, locationDetailsDoneCount: number): FolderGeoMediaCoverage {
  return {
    total,
    withGpsCount,
    withoutGpsCount: Math.max(0, total - withGpsCount),
    locationDetailsDoneCount,
  };
}

describe("summary card formatters", () => {
  it("maps AI pipeline status to card tones", () => {
    expect(statusTone(pipeline("done", 5, 5))).toBe("green");
    expect(statusTone(pipeline("partial", 3, 5))).toBe("amber");
    expect(statusTone(pipeline("not_done", 0, 5))).toBe("red");
    expect(statusTone(pipeline("empty", 0, 0))).toBe("neutral");
  });

  it("derives geo location extraction pipeline from GPS availability", () => {
    expect(mediaLocationPipeline(geo(10, 0, 0)).label).toBe("empty");
    expect(mediaLocationPipeline(geo(10, 4, 0)).label).toBe("not_done");
    expect(mediaLocationPipeline(geo(10, 4, 2)).label).toBe("partial");
    expect(mediaLocationPipeline(geo(10, 4, 4)).label).toBe("done");
  });

  it("combines image and video geo status with red taking precedence", () => {
    expect(combinedGeoTone(pipeline("done", 4, 4), pipeline("done", 2, 2))).toBe("green");
    expect(combinedGeoTone(pipeline("partial", 2, 4), pipeline("done", 2, 2))).toBe("amber");
    expect(combinedGeoTone(pipeline("not_done", 0, 4), pipeline("partial", 1, 2))).toBe("red");
  });
});

import { describe, expect, it } from "vitest";
import { buildFaceClusteringStatsText } from "./face-clustering-progress-stats";

describe("buildFaceClusteringStatsText", () => {
  it("shows faces loaded before clustering starts", () => {
    expect(
      buildFaceClusteringStatsText({
        status: "running",
        phase: "loading",
        processed: 0,
        total: 1,
        totalFaces: 257,
        clusterCount: null,
      }),
    ).toBe("Preparing faces: 0 / 257 | Faces: 257");
  });

  it("shows pair comparison progress during clustering", () => {
    expect(
      buildFaceClusteringStatsText({
        status: "running",
        phase: "clustering",
        processed: 1200,
        total: 5000,
        totalFaces: 257,
        clusterCount: null,
      }),
    ).toBe("Processed face pairs: 1'200 / 5'000 | Faces: 257");
  });

  it("includes groups after clustering completes", () => {
    expect(
      buildFaceClusteringStatsText({
        status: "completed",
        phase: null,
        processed: 11,
        total: 11,
        totalFaces: 257,
        clusterCount: 11,
      }),
    ).toBe("Clusters saved: 11 / 11 | Faces: 257 | Groups: 11");
  });

  it("does not show groups metric while job is still running", () => {
    expect(
      buildFaceClusteringStatsText({
        status: "running",
        phase: "persisting",
        processed: 3,
        total: 11,
        totalFaces: 257,
        clusterCount: null,
      }),
    ).toBe("Saving clusters: 3 / 11 | Faces: 257");
  });

  it("uses pair label when phase ended but total is still pair-shaped (e.g. cancelled mid-clustering)", () => {
    const totalPairs = (257 * 256) / 2;
    expect(
      buildFaceClusteringStatsText({
        status: "cancelled",
        phase: null,
        processed: 1200,
        total: totalPairs,
        totalFaces: 257,
        clusterCount: null,
      }),
    ).toBe(`Processed face pairs: 1'200 / ${formatExpectedPairTotal(totalPairs)} | Faces: 257`);
  });

  it("when n choose 2 equals n, still labels pair progress after some pairs (ambiguous totals)", () => {
    expect(
      buildFaceClusteringStatsText({
        status: "cancelled",
        phase: null,
        processed: 1,
        total: 3,
        totalFaces: 3,
        clusterCount: null,
      }),
    ).toBe("Processed face pairs: 1 / 3 | Faces: 3");
  });

  it("when n choose 2 equals n and no progress yet, treats as preparing (loading-shaped)", () => {
    expect(
      buildFaceClusteringStatsText({
        status: "cancelled",
        phase: null,
        processed: 0,
        total: 3,
        totalFaces: 3,
        clusterCount: null,
      }),
    ).toBe("Preparing faces: 0 / 3 | Faces: 3");
  });
});

function formatExpectedPairTotal(totalPairs: number): string {
  return totalPairs
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "'");
}

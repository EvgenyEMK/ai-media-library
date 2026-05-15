import { describe, expect, it } from "vitest";
import { shouldAutoFindFaceGroups } from "./face-clustering-auto";

const base = {
  clusterTotalCount: 0,
  stats: {
    readyUntaggedFaceCount: 25,
    ungroupedReadyUntaggedFaceCount: 25,
  },
  isLoading: false,
  isClusteringRunning: false,
  alreadyTriggered: false,
};

describe("shouldAutoFindFaceGroups", () => {
  it("auto-runs for small libraries with no existing clusters", () => {
    expect(shouldAutoFindFaceGroups(base)).toBe(true);
  });

  it("does not auto-run above the low-count threshold", () => {
    expect(
      shouldAutoFindFaceGroups({
        ...base,
        stats: {
          readyUntaggedFaceCount: 301,
          ungroupedReadyUntaggedFaceCount: 301,
        },
      }),
    ).toBe(false);
  });

  it("does not auto-run when clusters already exist", () => {
    expect(shouldAutoFindFaceGroups({ ...base, clusterTotalCount: 1 })).toBe(false);
  });

  it("does not auto-run more than once per tab session", () => {
    expect(shouldAutoFindFaceGroups({ ...base, alreadyTriggered: true })).toBe(false);
  });
});

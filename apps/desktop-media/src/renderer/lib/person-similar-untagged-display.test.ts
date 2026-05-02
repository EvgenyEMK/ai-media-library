import { describe, it, expect } from "vitest";
import { resolveSimilarUntaggedDisplay } from "./person-similar-untagged-display";
import type { DesktopPersonTagWithFaceCount } from "../../shared/ipc";

function row(similarFaceCount: number): DesktopPersonTagWithFaceCount {
  return {
    id: "t1",
    label: "Test",
    pinned: false,
    birthDate: null,
    taggedFaceCount: 0,
    similarFaceCount,
  };
}

describe("resolveSimilarUntaggedDisplay", () => {
  it("uses live count when present", () => {
    expect(
      resolveSimilarUntaggedDisplay(row(3), { t1: 9 }, "idle"),
    ).toEqual({ kind: "ready", value: 9 });
  });

  it("shows loading when job running and no live value", () => {
    expect(resolveSimilarUntaggedDisplay(row(2), {}, "running")).toEqual({ kind: "loading" });
  });

  it("falls back to row similarFaceCount when idle", () => {
    expect(resolveSimilarUntaggedDisplay(row(5), {}, "idle")).toEqual({
      kind: "fallback",
      value: 5,
    });
  });

  it("falls back on failed status", () => {
    expect(resolveSimilarUntaggedDisplay(row(1), {}, "failed")).toEqual({
      kind: "fallback",
      value: 1,
    });
  });
});

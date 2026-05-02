import { afterEach, describe, expect, it, vi } from "vitest";
import { pathAnalysisRendererDebugLog } from "./path-analysis-renderer-debug";

describe("pathAnalysisRendererDebugLog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not throw and skips console when debug flag is unset", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    pathAnalysisRendererDebugLog("x", 1);
    expect(spy).not.toHaveBeenCalled();
  });
});

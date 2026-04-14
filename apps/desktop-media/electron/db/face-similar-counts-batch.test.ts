import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./face-embeddings", () => ({
  countSimilarUntaggedFacesForPerson: vi.fn(),
}));

import { countSimilarUntaggedFacesForPerson } from "./face-embeddings";
import { getSimilarUntaggedFaceCountsForTags } from "./face-similar-counts-batch";

describe("getSimilarUntaggedFaceCountsForTags", () => {
  beforeEach(() => {
    vi.mocked(countSimilarUntaggedFacesForPerson).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("dedupes tag ids and returns one count per tag", () => {
    vi.mocked(countSimilarUntaggedFacesForPerson).mockImplementation((tagId: string) => {
      if (tagId === "t1") return 5;
      if (tagId === "t2") return 7;
      return 0;
    });

    const out = getSimilarUntaggedFaceCountsForTags(["t1", "t2", "t1"], { threshold: 0.55 });

    expect(out).toEqual({ t1: 5, t2: 7 });
    expect(countSimilarUntaggedFacesForPerson).toHaveBeenCalledTimes(2);
    expect(countSimilarUntaggedFacesForPerson).toHaveBeenCalledWith("t1", { threshold: 0.55 });
    expect(countSimilarUntaggedFacesForPerson).toHaveBeenCalledWith("t2", { threshold: 0.55 });
  });

  it("filters empty ids", () => {
    vi.mocked(countSimilarUntaggedFacesForPerson).mockReturnValue(0);

    expect(getSimilarUntaggedFaceCountsForTags(["", "x", ""])).toEqual({ x: 0 });
    expect(countSimilarUntaggedFacesForPerson).toHaveBeenCalledTimes(1);
    expect(countSimilarUntaggedFacesForPerson).toHaveBeenCalledWith("x", {});
  });
});

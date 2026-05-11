import { describe, expect, it, vi } from "vitest";
import { createSimilarImagesActions } from "./similar-images-actions";

describe("createSimilarImagesActions", () => {
  it("openSimilarImagesView calls openView with default minSimilarity 0.9", () => {
    const openView = vi.fn();
    const actions = createSimilarImagesActions({ openView });
    actions.openSimilarImagesView({ sourcePath: "/photos/a.jpg" });
    expect(openView).toHaveBeenCalledWith({ sourcePath: "/photos/a.jpg", minSimilarity: 0.9 });
  });

  it("openSimilarImagesView passes explicit minSimilarity", () => {
    const openView = vi.fn();
    const actions = createSimilarImagesActions({ openView });
    actions.openSimilarImagesView({ sourcePath: "/p/b.jpg", minSimilarity: 0.85 });
    expect(openView).toHaveBeenCalledWith({ sourcePath: "/p/b.jpg", minSimilarity: 0.85 });
  });
});

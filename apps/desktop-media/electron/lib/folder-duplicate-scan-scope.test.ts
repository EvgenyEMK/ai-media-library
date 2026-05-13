import path from "node:path";
import { describe, it, expect } from "vitest";
import { isMediaPathInFolderScope, scopeLikePatterns } from "./folder-duplicate-scan-scope";

describe("folder-duplicate-scan-scope", () => {
  it("scopeLikePatterns builds a LIKE prefix with separator", () => {
    const root = path.normalize("/photos");
    const { exact, like } = scopeLikePatterns(root);
    expect(exact).toBe(root);
    const sep = root.includes("\\") ? "\\" : "/";
    expect(like.startsWith(`${root}${sep}`)).toBe(true);
    expect(like.endsWith("%")).toBe(true);
  });

  it("non-recursive scope accepts only direct files under root", () => {
    const root = path.normalize("/library/a");
    const { exact } = scopeLikePatterns(root);
    expect(isMediaPathInFolderScope(path.normalize(`${root}/img.jpg`), exact, false)).toBe(true);
    expect(isMediaPathInFolderScope(path.normalize(`${root}/sub/img.jpg`), exact, false)).toBe(false);
  });

  it("recursive scope accepts nested files", () => {
    const root = path.normalize("/library/a");
    const { exact } = scopeLikePatterns(root);
    expect(isMediaPathInFolderScope(path.normalize(`${root}/sub/img.jpg`), exact, true)).toBe(true);
  });

  it("rejects path equal to folder itself", () => {
    const root = path.normalize("/library/a");
    const { exact } = scopeLikePatterns(root);
    expect(isMediaPathInFolderScope(root, exact, true)).toBe(false);
  });
});

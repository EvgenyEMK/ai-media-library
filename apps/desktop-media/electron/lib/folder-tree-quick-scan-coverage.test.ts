import { describe, expect, it } from "vitest";
import { listFolderPathsWithDirectMediaOnDisk } from "./folder-tree-quick-scan-coverage";

describe("listFolderPathsWithDirectMediaOnDisk", () => {
  it("returns only paths that have at least one media line on disk", () => {
    const paths = ["C:\\root", "C:\\root\\a", "C:\\root\\b"];
    const lines = new Map<string, string[]>([
      ["C:\\root", []],
      ["C:\\root\\a", ["x.jpg|1|2"]],
      ["C:\\root\\b", []],
    ]);
    expect(listFolderPathsWithDirectMediaOnDisk(paths, lines)).toEqual(["C:\\root\\a"]);
  });

  it("returns empty when no folder has direct media", () => {
    expect(listFolderPathsWithDirectMediaOnDisk(["C:\\root"], new Map([["C:\\root", []]]))).toEqual([]);
  });

  it("works with POSIX-style folder paths", () => {
    const paths = ["/media/root", "/media/root/a", "/media/root/b"];
    const lines = new Map<string, string[]>([
      ["/media/root", []],
      ["/media/root/a", ["x.jpg|1|2"]],
      ["/media/root/b", ["clip.mp4|3|4"]],
    ]);
    expect(listFolderPathsWithDirectMediaOnDisk(paths, lines)).toEqual([
      "/media/root/a",
      "/media/root/b",
    ]);
  });
});

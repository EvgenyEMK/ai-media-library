import { describe, expect, it } from "vitest";
import {
  formatComparablePathForDisplay,
  formatSelectedColumnFolderLine,
  inferPathDisplayStyle,
  splitFileNameAndComparableParent,
} from "./duplicate-files-display-paths";

describe("inferPathDisplayStyle", () => {
  it("uses posix for unix-style roots", () => {
    expect(inferPathDisplayStyle("/home/user/Photos")).toBe("posix");
  });

  it("uses win for drive-letter paths", () => {
    expect(inferPathDisplayStyle("C:/Photos")).toBe("win");
    expect(inferPathDisplayStyle("D:\\Data")).toBe("win");
  });
});

describe("formatComparablePathForDisplay", () => {
  it("converts slashes for Windows style", () => {
    expect(formatComparablePathForDisplay("C:/a/b", "win")).toBe("C:\\a\\b");
  });

  it("keeps forward slashes for posix style", () => {
    expect(formatComparablePathForDisplay("/home/a/b", "posix")).toBe("/home/a/b");
  });
});

describe("splitFileNameAndComparableParent", () => {
  it("splits basename and parent", () => {
    expect(splitFileNameAndComparableParent("/a/b/c.jpg")).toEqual({
      fileName: "c.jpg",
      parentComparable: "/a/b",
    });
  });
});

describe("formatSelectedColumnFolderLine", () => {
  it("returns empty when file is directly under root", () => {
    expect(formatSelectedColumnFolderLine("/photos/a.jpg", "/photos", "posix")).toBe("");
  });

  it("returns .../rel for nested path under root (posix)", () => {
    expect(formatSelectedColumnFolderLine("/photos/2024/jan/a.jpg", "/photos", "posix")).toBe(".../2024/jan");
  });

  it("returns ...\\rel under root for nested folders (win)", () => {
    expect(formatSelectedColumnFolderLine("C:/photos/2024/a.jpg", "C:/photos", "win")).toBe("...\\2024");
  });

  it("returns full parent when outside root", () => {
    expect(formatSelectedColumnFolderLine("/other/x/y.jpg", "/photos", "posix")).toBe("/other/x");
  });
});

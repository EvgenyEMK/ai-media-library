import { describe, expect, it } from "vitest";
import { folderPathMatchesStored } from "./folder-path-matching";

describe("folderPathMatchesStored", () => {
  it("matches exact normalized paths", () => {
    expect(folderPathMatchesStored("C:\\a\\b", "C:\\a\\b")).toBe(true);
  });

  it("matches case-insensitively when platform is win32", () => {
    const original = process.platform;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    expect(folderPathMatchesStored("C:\\Photos\\A", "c:\\photos\\a")).toBe(true);
    Object.defineProperty(process, "platform", { value: original, configurable: true });
  });

  it("matches forward vs backslash variants", () => {
    expect(folderPathMatchesStored("C:/photos/a", "C:\\photos\\a")).toBe(true);
  });

  it("matches exact POSIX paths without Windows-only case folding", () => {
    const original = process.platform;
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    expect(folderPathMatchesStored("/media/photos/A", "/media/photos/A")).toBe(true);
    expect(folderPathMatchesStored("/media/photos/A", "/media/photos/a")).toBe(false);
    Object.defineProperty(process, "platform", { value: original, configurable: true });
  });

  it("returns false for different paths", () => {
    expect(folderPathMatchesStored("C:\\a", "C:\\b")).toBe(false);
  });
});

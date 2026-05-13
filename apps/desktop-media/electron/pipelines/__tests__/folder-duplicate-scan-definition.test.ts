import { describe, it, expect } from "vitest";
import { folderDuplicateScanDefinition } from "../definitions/folder-duplicate-scan";

describe("folderDuplicateScanDefinition.validateParams", () => {
  it("accepts folderPath and defaults recursive to true", () => {
    const result = folderDuplicateScanDefinition.validateParams?.({ folderPath: "/media/a" });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.value.folderPath).toBe("/media/a");
      expect(result.value.recursive).toBe(true);
    }
  });

  it("treats recursive false explicitly", () => {
    const result = folderDuplicateScanDefinition.validateParams?.({
      folderPath: "/media/a",
      recursive: false,
    });
    expect(result?.ok).toBe(true);
    if (result?.ok) {
      expect(result.value.recursive).toBe(false);
    }
  });

  it("rejects empty folderPath", () => {
    const result = folderDuplicateScanDefinition.validateParams?.({ folderPath: "   " });
    expect(result?.ok).toBe(false);
  });
});

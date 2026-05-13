import { describe, expect, it } from "vitest";
import { duplicateMarkedFilesDeleteDefinition } from "../definitions/duplicate-marked-files-delete";

describe("duplicateMarkedFilesDeleteDefinition", () => {
  it("validateParams rejects empty targets", () => {
    const v = duplicateMarkedFilesDeleteDefinition.validateParams?.({ targets: [], useTrash: true });
    expect(v?.ok).toBe(false);
  });

  it("validateParams accepts valid targets", () => {
    const v = duplicateMarkedFilesDeleteDefinition.validateParams?.({
      targets: [{ mediaItemId: "a", sourcePath: "/x/y.jpg" }],
      useTrash: false,
    });
    expect(v?.ok).toBe(true);
    if (v?.ok) {
      expect(v.value.useTrash).toBe(false);
      expect(v.value.targets).toHaveLength(1);
    }
  });

  it("validateParams defaults useTrash to true when omitted", () => {
    const v = duplicateMarkedFilesDeleteDefinition.validateParams?.({
      targets: [{ mediaItemId: "a", sourcePath: "/p/z.png" }],
    });
    expect(v?.ok).toBe(true);
    if (v?.ok) {
      expect(v.value.useTrash).toBe(true);
    }
  });
});

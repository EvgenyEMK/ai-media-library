import { describe, expect, it } from "vitest";
import { parseDuplicateMarkedFilesDeleteJobOutput } from "./duplicate-files-delete-job-output";

describe("parseDuplicateMarkedFilesDeleteJobOutput", () => {
  it("parses valid output", () => {
    const r = parseDuplicateMarkedFilesDeleteJobOutput({
      deletedMediaItemIds: ["a", "b"],
      failed: [{ mediaItemId: "c", sourcePath: "/x", error: "e" }],
    });
    expect(r).toEqual({
      deletedMediaItemIds: ["a", "b"],
      failed: [{ mediaItemId: "c", sourcePath: "/x", error: "e" }],
    });
  });

  it("returns null for invalid shapes", () => {
    expect(parseDuplicateMarkedFilesDeleteJobOutput(null)).toBeNull();
    expect(parseDuplicateMarkedFilesDeleteJobOutput({ deletedMediaItemIds: [] })).toBeNull();
  });
});

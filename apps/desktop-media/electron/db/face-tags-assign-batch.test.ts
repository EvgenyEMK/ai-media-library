import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const runCalls: { sql: string; args: unknown[] }[] = [];

const mockDb = {
  prepare: (sql: string) => ({
    get: (...args: unknown[]) => {
      if (sql.includes("SELECT media_item_id FROM media_face_instances")) {
        const faceId = args[0] as string;
        if (faceId === "missing") {
          return undefined;
        }
        return { media_item_id: `media-for-${faceId}` };
      }
      return undefined;
    },
    run: (...args: unknown[]) => {
      runCalls.push({ sql, args });
      return { changes: 1 };
    },
  }),
  transaction: (fn: () => void) => () => {
    fn();
  },
};

vi.mock("./client", () => ({
  getDesktopDatabase: () => mockDb,
}));

vi.mock("./folder-analysis-status", () => ({
  DEFAULT_LIBRARY_ID: "lib-1",
}));

import { assignPersonTagsToFaceInstances } from "./face-tags";

describe("assignPersonTagsToFaceInstances", () => {
  beforeEach(() => {
    runCalls.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("updates multiple face rows in one transaction", () => {
    const { assignedCount, affectedMediaItemIds } = assignPersonTagsToFaceInstances(
      ["f1", "f2"],
      "tag-a",
    );
    expect(assignedCount).toBe(2);
    expect(new Set(affectedMediaItemIds)).toEqual(new Set(["media-for-f1", "media-for-f2"]));
    const updates = runCalls.filter((c) => c.sql.includes("UPDATE media_face_instances"));
    expect(updates.length).toBe(2);
  });

  it("dedupes face ids and skips unknown ids", () => {
    const { assignedCount } = assignPersonTagsToFaceInstances(
      ["f1", "f1", "missing"],
      "tag-a",
    );
    expect(assignedCount).toBe(1);
  });
});

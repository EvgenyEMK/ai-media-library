import path from "node:path";
import { pathToFileURL } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCalls: { sql: string; args: unknown[] }[] = [];
const allCalls: { sql: string; args: unknown[] }[] = [];

/** POSIX-style paths so path.relative / pathToFileURL match CI (Linux) and dev (Windows). */
const LIBRARY_ROOT = "/photos";
const ITEM_SOURCE = `${LIBRARY_ROOT}/trip/rotated.jpg`;

const rows = [
  {
    id: "item-1",
    source_path: ITEM_SOURCE,
    filename: "rotated.jpg",
    ai_metadata: JSON.stringify({
      orientation_detection: {
        correction_angle_clockwise: 90,
        confidence: 0.96,
        processed_at: "2026-05-01T12:00:00.000Z",
      },
      edit_suggestions: [
        {
          edit_type: "crop",
          crop_rel: { x: 0.1, y: 0.2, width: 0.7, height: 0.6 },
        },
      ],
    }),
  },
];

const mockDb = {
  prepare: (sql: string) => ({
    get: (...args: unknown[]) => {
      getCalls.push({ sql, args });
      return { total: rows.length };
    },
    all: (...args: unknown[]) => {
      allCalls.push({ sql, args });
      return rows;
    },
  }),
};

vi.mock("./client", () => ({
  getDesktopDatabase: () => mockDb,
}));

vi.mock("./folder-analysis-status", () => ({
  DEFAULT_LIBRARY_ID: "local-default",
}));

import {
  buildWronglyRotatedImagesQueryParts,
  getWronglyRotatedImagesPage,
} from "./folder-ai-wrongly-rotated-images";

describe("getWronglyRotatedImagesPage", () => {
  beforeEach(() => {
    getCalls.length = 0;
    allCalls.length = 0;
  });

  it("uses the same orientation-success predicate as folder coverage", () => {
    const parts = buildWronglyRotatedImagesQueryParts({
      folderPath: LIBRARY_ROOT,
      recursive: true,
    });

    expect(parts.whereSql).toContain("$.orientation_detection.correction_angle_clockwise");
    expect(parts.whereSql).toContain("$.orientation_detection_error");
    expect(parts.whereSql).toContain("$.orientation_detection.processed_at");
    expect(parts.whereSql).toContain("$.orientation_detection_error.failed_at");
    expect(parts.whereSql).toContain("$.orientation_detection.confidence");
    expect(parts.whereSql).toContain("$.wrong_rotation_user_dismissed.dismissed_at");
    expect(parts.whereSql).toContain("$.orientation_detection.user_dismissed.dismissed_at");
    expect(parts.whereArgs).toEqual(["local-default", `${LIBRARY_ROOT}/%`, 0.9]);
  });

  it("uses configured confidence threshold and permanent dismissal predicate", () => {
    const parts = buildWronglyRotatedImagesQueryParts({
      folderPath: LIBRARY_ROOT,
      recursive: true,
      minConfidenceThreshold: 0.95,
    });

    expect(parts.whereSql).toContain("CAST(json_extract(mi.ai_metadata, '$.orientation_detection.confidence') AS REAL) >= ?");
    expect(parts.whereSql).toContain(
      "json_extract(mi.ai_metadata, '$.wrong_rotation_user_dismissed.dismissed_at') IS NULL",
    );
    expect(parts.whereSql).toContain(
      "json_extract(mi.ai_metadata, '$.orientation_detection.user_dismissed.dismissed_at') IS NULL",
    );
    expect(parts.whereArgs).toEqual(["local-default", `${LIBRARY_ROOT}/%`, 0.95]);
  });

  it("returns a paginated page with rotation and crop preview data", () => {
    const page = getWronglyRotatedImagesPage({
      folderPath: LIBRARY_ROOT,
      recursive: true,
      page: 2,
      pageSize: 12,
    });

    const relDir = path.relative(
      path.normalize(LIBRARY_ROOT),
      path.dirname(path.normalize(ITEM_SOURCE)),
    );
    const folderPathRelative = relDir && relDir !== "." ? relDir : null;

    expect(page).toEqual({
      total: 1,
      page: 2,
      pageSize: 12,
      items: [
        {
          id: "item-1",
          sourcePath: ITEM_SOURCE,
          name: "rotated.jpg",
          imageUrl: pathToFileURL(ITEM_SOURCE).toString(),
          folderPathRelative,
          rotationAngleClockwise: 90,
          cropRel: { x: 0.1, y: 0.2, width: 0.7, height: 0.6 },
          confidence: 0.96,
          orientationDetectionProcessedAt: "2026-05-01T12:00:00.000Z",
        },
      ],
    });
    expect(getCalls[0]?.sql).toContain("COUNT(*) AS total");
    expect(allCalls[0]?.sql).toContain("$.orientation_detection.confidence");
    expect(allCalls[0]?.sql).toContain("DESC");
    expect(allCalls[0]?.sql).toContain("LIMIT ? OFFSET ?");
    expect(allCalls[0]?.args.slice(-2)).toEqual([12, 12]);
  });
});

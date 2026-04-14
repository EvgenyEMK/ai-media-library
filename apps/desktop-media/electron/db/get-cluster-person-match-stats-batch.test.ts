import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

interface MockRow {
  [key: string]: unknown;
}

let mockPrepareResults: Map<string, { all?: MockRow[]; get?: MockRow | undefined }>;

function findMockEntry(sql: string) {
  for (const [key, value] of mockPrepareResults) {
    if (sql.includes(key)) {
      return value;
    }
  }
  return null;
}

const mockDb = {
  prepare: (sql: string) => {
    const entry = findMockEntry(sql) ?? { all: [] };
    return {
      all: (..._args: unknown[]) => entry.all ?? [],
      get: (..._args: unknown[]) => entry.get ?? undefined,
    };
  },
};

vi.mock("./client", () => ({
  getDesktopDatabase: () => mockDb,
}));

vi.mock("./folder-analysis-status", () => ({
  DEFAULT_LIBRARY_ID: "lib-1",
}));

vi.mock("../../src/shared/ipc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/shared/ipc")>();
  return {
    ...actual,
    DEFAULT_FACE_DETECTION_SETTINGS: {
      ...actual.DEFAULT_FACE_DETECTION_SETTINGS,
      faceRecognitionSimilarityThreshold: 0.5,
    },
  };
});

import { getClusterPersonCentroidMatchStatsBatch } from "./face-embeddings";

beforeEach(() => {
  mockPrepareResults = new Map();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getClusterPersonCentroidMatchStatsBatch", () => {
  it("counts members and centroid matches per cluster", () => {
    mockPrepareResults.set("embedding_model, embedding_dimension", {
      get: {
        centroid_json: JSON.stringify([1, 0]),
        embedding_model: "m",
        embedding_dimension: 2,
        sample_count: 1,
      },
    });
    mockPrepareResults.set("fi.cluster_id IN", {
      all: [
        { cluster_id: "c1", embedding_json: JSON.stringify([0.9, 0.1]) },
        { cluster_id: "c1", embedding_json: JSON.stringify([0, 1]) },
        { cluster_id: "c2", embedding_json: JSON.stringify([0.95, 0.05]) },
      ],
    });

    const out = getClusterPersonCentroidMatchStatsBatch(
      [
        { clusterId: "c1", tagId: "t1" },
        { clusterId: "c2", tagId: "t1" },
      ],
      { threshold: 0.85, libraryId: "lib-1" },
    );

    expect(out.c1).toEqual({
      memberCount: 2,
      matchingCount: 1,
      midBandCount: 0,
      belowMidCount: 1,
    });
    expect(out.c2).toEqual({
      memberCount: 1,
      matchingCount: 1,
      midBandCount: 0,
      belowMidCount: 0,
    });
  });
});

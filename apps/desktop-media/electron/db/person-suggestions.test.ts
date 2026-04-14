import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

/**
 * Unit tests for the person-suggestions module.
 *
 * These tests mock the SQLite database layer to verify:
 * - refreshSuggestionsForTag populates suggestions above threshold
 * - refreshSuggestionsForTag clears suggestions when centroid is missing
 * - refreshAllSuggestions iterates all person tags
 * - clearSuggestionsForMediaItemTag removes a specific row
 * - Only the best similarity per media item is kept
 */

interface MockRow {
  [key: string]: unknown;
}

let mockPrepareResults: Map<string, { all: MockRow[]; get?: MockRow | undefined; run?: { changes: number } }>;
let runCalls: Array<{ sql: string; args: unknown[] }>;
let transactionFn: (() => void) | null;

const mockDb = {
  prepare: (sql: string) => {
    const entry = findMockEntry(sql);
    return {
      all: (...args: unknown[]) => {
        return entry?.all ?? [];
      },
      get: (...args: unknown[]) => {
        return entry?.get ?? undefined;
      },
      run: (...args: unknown[]) => {
        runCalls.push({ sql, args });
        return entry?.run ?? { changes: 0 };
      },
    };
  },
  transaction: (fn: () => void) => {
    transactionFn = fn;
    return () => {
      if (transactionFn) transactionFn();
    };
  },
};

function findMockEntry(sql: string) {
  for (const [key, value] of mockPrepareResults) {
    if (sql.includes(key)) {
      return value;
    }
  }
  return null;
}

vi.mock("./client", () => ({
  getDesktopDatabase: () => mockDb,
}));

vi.mock("./folder-analysis-status", () => ({
  DEFAULT_LIBRARY_ID: "test-lib",
}));

const findMatchesForPersonMock = vi.hoisted(() => vi.fn());

vi.mock("./face-embeddings", () => ({
  findMatchesForPerson: findMatchesForPersonMock,
}));

import {
  refreshSuggestionsForTag,
  refreshAllSuggestions,
  clearSuggestionsForMediaItemTag,
} from "./person-suggestions";

beforeEach(() => {
  mockPrepareResults = new Map();
  runCalls = [];
  transactionFn = null;
  findMatchesForPersonMock.mockReset();
  findMatchesForPersonMock.mockReturnValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("refreshSuggestionsForTag", () => {
  it("clears suggestions and returns 0 when no centroid exists", () => {
    mockPrepareResults.set("person_centroids", { all: [], get: undefined });
    mockPrepareResults.set("DELETE FROM media_item_person_suggestions", {
      all: [],
      run: { changes: 0 },
    });

    const count = refreshSuggestionsForTag("tag-1");
    expect(count).toBe(0);

    expect(findMatchesForPersonMock).not.toHaveBeenCalled();

    const deleteCalls = runCalls.filter((c) =>
      c.sql.includes("DELETE FROM media_item_person_suggestions"),
    );
    expect(deleteCalls.length).toBe(1);
  });

  it("populates suggestions for faces above threshold", () => {
    const centroid = [1, 0, 0]; // unit vector along dim 0
    mockPrepareResults.set("person_centroids", {
      all: [],
      get: { centroid_json: JSON.stringify(centroid) },
    });

    // Two faces on same media item, one on a different media item.
    // Face A: high similarity (same direction)
    // Face B: low similarity (orthogonal)
    // Face C: medium similarity (on a different media item)
    const faceA = { id: "face-a", media_item_id: "media-1", embedding_json: JSON.stringify([0.9, 0.1, 0]) };
    const faceB = { id: "face-b", media_item_id: "media-1", embedding_json: JSON.stringify([0, 1, 0]) };
    const faceC = { id: "face-c", media_item_id: "media-2", embedding_json: JSON.stringify([0.7, 0.5, 0]) };

    mockPrepareResults.set("media_face_instances", {
      all: [faceA, faceB, faceC],
    });
    mockPrepareResults.set("DELETE FROM media_item_person_suggestions", {
      all: [],
      run: { changes: 0 },
    });
    mockPrepareResults.set("INSERT INTO media_item_person_suggestions", {
      all: [],
      run: { changes: 1 },
    });
    mockPrepareResults.set("UPDATE person_centroids", {
      all: [],
      run: { changes: 1 },
    });

    findMatchesForPersonMock.mockReturnValue([{ faceInstanceId: "a" }, { faceInstanceId: "b" }]);

    const count = refreshSuggestionsForTag("tag-1", { threshold: 0.5 });

    // faceA has high similarity (~0.99), faceB is orthogonal (~0.1), faceC moderate (~0.81)
    // media-1 should get faceA (best), media-2 should get faceC
    expect(count).toBe(2);

    const insertCalls = runCalls.filter((c) =>
      c.sql.includes("INSERT INTO media_item_person_suggestions"),
    );
    expect(insertCalls.length).toBe(2);

    const centroidStat = runCalls.find((c) => c.sql.includes("UPDATE person_centroids"));
    expect(centroidStat).toBeDefined();
    expect(centroidStat?.args[0]).toBe(2);
    expect(findMatchesForPersonMock).toHaveBeenCalledWith(
      "tag-1",
      expect.objectContaining({ threshold: 0.5, limit: 0, libraryId: "test-lib" }),
    );
  });

  it("keeps only the best similarity per media item", () => {
    const centroid = [1, 0];
    mockPrepareResults.set("person_centroids", {
      all: [],
      get: { centroid_json: JSON.stringify(centroid) },
    });

    const face1 = { id: "f1", media_item_id: "m1", embedding_json: JSON.stringify([0.8, 0.2]) };
    const face2 = { id: "f2", media_item_id: "m1", embedding_json: JSON.stringify([0.95, 0.05]) };

    mockPrepareResults.set("media_face_instances", { all: [face1, face2] });
    mockPrepareResults.set("DELETE FROM media_item_person_suggestions", { all: [], run: { changes: 0 } });
    mockPrepareResults.set("INSERT INTO media_item_person_suggestions", { all: [], run: { changes: 1 } });
    mockPrepareResults.set("UPDATE person_centroids", { all: [], run: { changes: 1 } });

    findMatchesForPersonMock.mockReturnValue([{ faceInstanceId: "x" }, { faceInstanceId: "y" }]);

    const count = refreshSuggestionsForTag("tag-1", { threshold: 0.3 });
    expect(count).toBe(1);

    const insertCalls = runCalls.filter((c) =>
      c.sql.includes("INSERT INTO media_item_person_suggestions"),
    );
    expect(insertCalls.length).toBe(1);

    // The exemplar should be face2 (higher similarity)
    const insertArgs = insertCalls[0].args;
    expect(insertArgs).toContain("f2");

    const stat = runCalls.find((c) => c.sql.includes("UPDATE person_centroids"));
    expect(stat?.args[0]).toBe(2);
  });

  it("stores findMatchesForPerson full-library count on person_centroids, not only the 50k scan", () => {
    const centroid = [1, 0];
    mockPrepareResults.set("person_centroids", {
      all: [],
      get: { centroid_json: JSON.stringify(centroid) },
    });
    const face1 = { id: "f1", media_item_id: "m1", embedding_json: JSON.stringify([0.9, 0.1]) };
    mockPrepareResults.set("media_face_instances", { all: [face1] });
    mockPrepareResults.set("DELETE FROM media_item_person_suggestions", { all: [], run: { changes: 0 } });
    mockPrepareResults.set("INSERT INTO media_item_person_suggestions", { all: [], run: { changes: 1 } });
    mockPrepareResults.set("UPDATE person_centroids", { all: [], run: { changes: 1 } });

    const many = Array.from({ length: 4245 }, (_, i) => ({ faceInstanceId: `face-${i}` }));
    findMatchesForPersonMock.mockReturnValue(many);

    refreshSuggestionsForTag("tag-denis", { threshold: 0.55 });

    const stat = runCalls.find((c) => c.sql.includes("UPDATE person_centroids"));
    expect(stat?.args[0]).toBe(4245);
  });
});

describe("refreshAllSuggestions", () => {
  it("iterates all person tags with centroids", () => {
    mockPrepareResults.set("SELECT tag_id FROM person_centroids", {
      all: [{ tag_id: "t1" }, { tag_id: "t2" }],
    });
    mockPrepareResults.set("person_centroids WHERE tag_id", {
      all: [],
      get: undefined,
    });
    mockPrepareResults.set("DELETE FROM media_item_person_suggestions", {
      all: [],
      run: { changes: 0 },
    });

    const total = refreshAllSuggestions();
    expect(total).toBe(0);
  });
});

describe("clearSuggestionsForMediaItemTag", () => {
  it("runs DELETE with correct parameters", () => {
    mockPrepareResults.set("DELETE FROM media_item_person_suggestions", {
      all: [],
      run: { changes: 1 },
    });

    clearSuggestionsForMediaItemTag("media-1", "tag-1");

    const deleteCalls = runCalls.filter((c) =>
      c.sql.includes("DELETE FROM media_item_person_suggestions"),
    );
    expect(deleteCalls.length).toBe(1);
    expect(deleteCalls[0].args).toContain("media-1");
    expect(deleteCalls[0].args).toContain("tag-1");
  });
});

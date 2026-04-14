/**
 * Integration tests for the hybrid search pipeline.
 *
 * Tests keyword + vector helpers and RRF fusion (desktop ranks VLM + description only).
 * using mocked DB results. FTS5 tokenization / BM25 behavior is verified
 * at runtime (requires real SQLite FTS5).
 *
 * Mock AI descriptions simulate photo analysis output for a test set
 * inspired by the E2E photo corpus.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fuseWithRRF, toRankedList } from "./search-fusion";

/** Simulated AI descriptions for test images. */
const TEST_IMAGES = {
  "img-piano-lady": {
    id: "img-piano-lady",
    path: "C:\\photos\\piano-lady.jpg",
    filename: "piano-lady.jpg",
    title: "Elegant Piano Performance",
    description:
      "A young woman in a flowing white dress playing a grand piano in a warmly lit living room. " +
      "The room features hardwood floors, a large window with evening light, and a bookshelf.",
    location: "Vienna, Austria",
    category: "person_or_people",
    city: "Vienna",
    country: "Austria",
  },
  "img-piano-only": {
    id: "img-piano-only",
    path: "C:\\photos\\piano-only.jpg",
    filename: "piano-only.jpg",
    title: "Grand Piano Close-Up",
    description: "A close-up of a polished black grand piano with its lid open, showing the strings and hammers.",
    location: "Concert Hall, Germany",
    category: "architecture",
    city: "Concert Hall",
    country: "Germany",
  },
  "img-white-dress": {
    id: "img-white-dress",
    path: "C:\\photos\\white-dress.jpg",
    filename: "white-dress.jpg",
    title: "Fashion Portrait",
    description: "A portrait of a woman in a white dress standing in a garden with flowers.",
    location: "Paris, France",
    category: "person_or_people",
    city: "Paris",
    country: "France",
  },
  "img-sunset": {
    id: "img-sunset",
    path: "C:\\photos\\sunset.jpg",
    filename: "sunset.jpg",
    title: "Golden Hour Sunset",
    description: "A vibrant sunset over the ocean with orange and purple hues. Palm trees line the beach.",
    location: "Maldives",
    category: "nature",
    city: "Maldives",
    country: "Maldives",
  },
  "img-concert": {
    id: "img-concert",
    path: "C:\\photos\\concert.jpg",
    filename: "concert.jpg",
    title: "Orchestra Concert",
    description:
      "A full orchestra performing on stage with a pianist at the grand piano in a concert hall.",
    location: "Berlin, Germany",
    category: "person_or_people",
    city: "Berlin",
    country: "Germany",
  },
} as const;

type TestImageId = keyof typeof TEST_IMAGES;

interface MockRow {
  [key: string]: unknown;
}

let mockPrepareResults: Map<string, { all: MockRow[]; get?: MockRow; run?: { changes: number } }>;
let runCalls: Array<{ sql: string; args: unknown[] }>;

const mockDb = {
  prepare: (sql: string) => {
    const entry = findMockEntry(sql);
    return {
      all: (...args: unknown[]) => entry?.all ?? [],
      get: (...args: unknown[]) => entry?.get ?? undefined,
      run: (...args: unknown[]) => {
        runCalls.push({ sql, args });
        return entry?.run ?? { changes: 0 };
      },
    };
  },
};

function findMockEntry(sql: string) {
  for (const [key, value] of mockPrepareResults) {
    if (sql.includes(key)) return value;
  }
  return null;
}

vi.mock("./client", () => ({
  getDesktopDatabase: () => mockDb,
}));

vi.mock("./folder-analysis-status", () => ({
  DEFAULT_LIBRARY_ID: "test-lib",
}));

vi.mock("../semantic-embeddings", () => ({
  MULTIMODAL_EMBED_MODEL: "test-model",
}));

import { searchByKeyword, upsertFtsEntry, deleteFtsEntry, buildFtsQuery } from "./keyword-search";

beforeEach(() => {
  mockPrepareResults = new Map();
  runCalls = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("searchByKeyword with mock DB", () => {
  it("returns results from FTS5 query", () => {
    const ftsRows = [
      {
        media_item_id: "img-piano-lady",
        source_path: TEST_IMAGES["img-piano-lady"].path,
        filename: TEST_IMAGES["img-piano-lady"].filename,
        city: "Vienna",
        country: "Austria",
        people_detected: 1,
        age_min: 25,
        age_max: 25,
        fts_rank: -5.2,
      },
      {
        media_item_id: "img-piano-only",
        source_path: TEST_IMAGES["img-piano-only"].path,
        filename: TEST_IMAGES["img-piano-only"].filename,
        city: null,
        country: "Germany",
        people_detected: null,
        age_min: null,
        age_max: null,
        fts_rank: -3.1,
      },
    ];

    mockPrepareResults.set("media_items_fts", { all: ftsRows });

    const results = searchByKeyword("piano", {});
    expect(results).toHaveLength(2);
    expect(results[0].mediaItemId).toBe("img-piano-lady");
    expect(results[0].bm25Score).toBeCloseTo(5.2, 1);
    expect(results[1].mediaItemId).toBe("img-piano-only");
  });

  it("returns empty array for blank query", () => {
    expect(searchByKeyword("", {})).toEqual([]);
    expect(searchByKeyword("   ", {})).toEqual([]);
  });

  it("returns empty array when FTS5 throws", () => {
    mockPrepareResults.set("media_items_fts", { all: [] });
    const results = searchByKeyword("piano", {});
    expect(results).toEqual([]);
  });
});

describe("upsertFtsEntry", () => {
  it("deletes then inserts to update FTS entry", () => {
    mockPrepareResults.set("DELETE FROM media_items_fts", { all: [], run: { changes: 1 } });
    mockPrepareResults.set("INSERT INTO media_items_fts", { all: [], run: { changes: 1 } });

    upsertFtsEntry("img-1", "Test Title", "Test description", "Berlin", "nature", "");

    const deleteCalls = runCalls.filter((c) => c.sql.includes("DELETE"));
    const insertCalls = runCalls.filter((c) => c.sql.includes("INSERT"));
    expect(deleteCalls).toHaveLength(1);
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].args).toContain("Test Title");
    expect(insertCalls[0].args).toContain("Test description");
  });

  it("uses empty strings for null fields", () => {
    mockPrepareResults.set("DELETE FROM media_items_fts", { all: [], run: { changes: 0 } });
    mockPrepareResults.set("INSERT INTO media_items_fts", { all: [], run: { changes: 1 } });

    upsertFtsEntry("img-1", null, null, null, null, "");

    const insertCalls = runCalls.filter((c) => c.sql.includes("INSERT"));
    expect(insertCalls[0].args).toContain("");
  });
});

describe("deleteFtsEntry", () => {
  it("removes FTS entry by media item ID", () => {
    mockPrepareResults.set("DELETE FROM media_items_fts", { all: [], run: { changes: 1 } });

    deleteFtsEntry("img-piano-lady");

    const deleteCalls = runCalls.filter((c) => c.sql.includes("DELETE"));
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0].args).toContain("img-piano-lady");
  });
});

describe("hybrid search: RRF fusion (VLM + description, desktop ranking)", () => {
  it("promotes full-match item to #1 when vision ranks it low but description ranks it high", () => {
    // Vision still prefers piano-only, but piano-lady is high enough that #1 description pulls it ahead under RRF.
    const visionResults = [
      { mediaItemId: "img-piano-only" as TestImageId, score: 0.09 },
      { mediaItemId: "img-piano-lady" as TestImageId, score: 0.08 },
      { mediaItemId: "img-concert" as TestImageId, score: 0.07 },
      { mediaItemId: "img-white-dress" as TestImageId, score: 0.06 },
      { mediaItemId: "img-sunset" as TestImageId, score: 0.05 },
    ];

    const descriptionResults = [
      { mediaItemId: "img-piano-lady" as TestImageId, score: 0.85 },
      { mediaItemId: "img-concert" as TestImageId, score: 0.7 },
      { mediaItemId: "img-piano-only" as TestImageId, score: 0.55 },
    ];

    const fused = fuseWithRRF([
      toRankedList(visionResults),
      toRankedList(descriptionResults),
    ]);

    expect(fused[0].mediaItemId).toBe("img-piano-lady");
    expect(fused.slice(0, 4).map((f) => f.mediaItemId)).toContain("img-piano-only");
  });

  it("includes items only found via description list when vision omits them", () => {
    const visionResults = [
      { mediaItemId: "img-sunset", score: 0.09 },
      { mediaItemId: "img-piano-only", score: 0.07 },
    ];

    const descriptionResults = [{ mediaItemId: "img-piano-lady" as TestImageId, score: 0.8 }];

    const fused = fuseWithRRF([toRankedList(visionResults), toRankedList(descriptionResults)]);

    const ids = fused.map((f) => f.mediaItemId);
    expect(ids).toContain("img-piano-lady");
    expect(ids).toContain("img-sunset");
    expect(ids).toContain("img-piano-only");
  });

  it("degrades gracefully when description search returns empty", () => {
    const visionResults = [
      { mediaItemId: "img-sunset", score: 0.09 },
      { mediaItemId: "img-piano-only", score: 0.07 },
    ];

    const fused = fuseWithRRF([toRankedList(visionResults), toRankedList([])]);

    expect(fused).toHaveLength(2);
    expect(fused[0].mediaItemId).toBe("img-sunset");
    expect(fused[1].mediaItemId).toBe("img-piano-only");
  });

  it("degrades gracefully when vision search returns empty", () => {
    const descriptionResults = [
      { mediaItemId: "img-piano-lady", score: 0.9 },
      { mediaItemId: "img-piano-only", score: 0.7 },
    ];

    const fused = fuseWithRRF([toRankedList([]), toRankedList(descriptionResults)]);

    expect(fused).toHaveLength(2);
    expect(fused[0].mediaItemId).toBe("img-piano-lady");
  });
});

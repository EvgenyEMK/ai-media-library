import { beforeEach, describe, expect, it, vi } from "vitest";

const allCalls: { sql: string; args: unknown[] }[] = [];

const mockDb = {
  prepare: (sql: string) => ({
    all: (...args: unknown[]) => {
      allCalls.push({ sql, args });
      return args.slice(1).map((id) => ({
        id,
        source_path: `C:/photos/${id}.jpg`,
        latitude: 1,
        longitude: 2,
      }));
    },
  }),
};

vi.mock("./client", () => ({
  getDesktopDatabase: () => mockDb,
}));

vi.mock("./folder-analysis-status", () => ({
  DEFAULT_LIBRARY_ID: "lib-1",
}));

import { getMediaItemsNeedingGpsGeocoding } from "./media-item-geocoding";

describe("getMediaItemsNeedingGpsGeocoding", () => {
  beforeEach(() => {
    allCalls.length = 0;
  });

  it("chunks large ID lists under SQLite variable limits", () => {
    const ids = Array.from({ length: 1805 }, (_, i) => `item-${i}`);

    const rows = getMediaItemsNeedingGpsGeocoding(ids, "library-a");

    expect(rows).toHaveLength(1805);
    expect(allCalls).toHaveLength(3);
    expect(allCalls.map((call) => call.args.length)).toEqual([901, 901, 6]);
    expect(allCalls.every((call) => call.args[0] === "library-a")).toBe(true);
  });

  it("does not query for an empty ID list", () => {
    expect(getMediaItemsNeedingGpsGeocoding([])).toEqual([]);
    expect(allCalls).toHaveLength(0);
  });
});

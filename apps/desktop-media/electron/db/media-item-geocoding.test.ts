import { beforeEach, describe, expect, it, vi } from "vitest";

const allCalls: { sql: string; args: unknown[] }[] = [];
const runCalls: { sql: string; args: unknown[] }[] = [];
let nextRunChanges = 0;

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
    run: (...args: unknown[]) => {
      runCalls.push({ sql, args });
      return { changes: nextRunChanges };
    },
  }),
};

vi.mock("./client", () => ({
  getDesktopDatabase: () => mockDb,
}));

vi.mock("./folder-analysis-status", () => ({
  DEFAULT_LIBRARY_ID: "lib-1",
}));

import {
  getMediaItemsNeedingGpsGeocoding,
  updateMediaItemLocationFromGps,
} from "./media-item-geocoding";

describe("getMediaItemsNeedingGpsGeocoding", () => {
  beforeEach(() => {
    allCalls.length = 0;
    runCalls.length = 0;
    nextRunChanges = 0;
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

  it("does not treat optional admin2/county as required geocoding data", () => {
    getMediaItemsNeedingGpsGeocoding(["item-1"], "library-a");

    expect(allCalls[0]?.sql).not.toContain("location_area2 IS NULL");
  });
});

describe("updateMediaItemLocationFromGps", () => {
  beforeEach(() => {
    allCalls.length = 0;
    runCalls.length = 0;
    nextRunChanges = 0;
  });

  it("returns the database change count from a meaningful GPS location update", () => {
    nextRunChanges = 1;

    const changes = updateMediaItemLocationFromGps(
      "item-1",
      {
        countryCode: "DE",
        countryName: "Germany",
        admin1Name: "Baden-Württemberg",
        admin2Name: null,
        cityName: "Gomaringen",
        distance: 3.66,
      },
      "library-a",
    );

    expect(changes).toBe(1);
    expect(runCalls).toHaveLength(1);
    expect(runCalls[0]?.sql).toContain("country IS NOT ?");
    expect(runCalls[0]?.sql).toContain("location_area2 IS NOT ?");
    expect(runCalls[0]?.args.slice(0, 4)).toEqual([
      "Germany",
      "Gomaringen",
      "Baden-Württemberg",
      null,
    ]);
    expect(runCalls[0]?.args.slice(-4)).toEqual([
      "Germany",
      "Gomaringen",
      "Baden-Württemberg",
      null,
    ]);
  });
});

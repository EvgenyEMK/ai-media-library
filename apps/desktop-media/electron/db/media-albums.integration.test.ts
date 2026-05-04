import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

function canOpenSqlite(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3") as new (path: string) => { close: () => void };
    const db = new Database(":memory:");
    db.close();
    return true;
  } catch {
    return false;
  }
}

const HAS_SQLITE = canOpenSqlite();
const LIBRARY_ID = "local-default";

type ClientModule = typeof import("./client");
type AlbumsModule = typeof import("./media-albums");
type ReconciliationModule = typeof import("./media-item-reconciliation");

let client!: ClientModule;
let albums!: AlbumsModule;
let reconciliation!: ReconciliationModule;
let tmpDir = "";

function insertMediaItem(args: {
  id: string;
  sourcePath: string;
  starRating: number | null;
  aiQuality: number | null;
  imageCategory?: string | null;
  city?: string | null;
  country?: string | null;
  locationArea?: string | null;
  locationArea2?: string | null;
  locationSource?: "gps" | "ai_vision" | "path_script" | null;
  photoTakenAt?: string | null;
}): void {
  const now = "2026-01-01T00:00:00.000Z";
  client
    .getDesktopDatabase()
    .prepare(
      `INSERT INTO media_items (
        id, library_id, source_path, filename, star_rating, ai_metadata,
        city, country, location_area, location_area2, location_source, photo_taken_at, media_kind, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'image', ?, ?)`,
    )
    .run(
      args.id,
      LIBRARY_ID,
      args.sourcePath,
      path.basename(args.sourcePath),
      args.starRating,
      args.aiQuality === null
        ? null
        : JSON.stringify({
            image_analysis: {
              photo_estetic_quality: args.aiQuality,
              image_category: args.imageCategory ?? null,
            },
          }),
      args.city ?? null,
      args.country ?? null,
      args.locationArea ?? null,
      args.locationArea2 ?? null,
      args.locationSource ?? "gps",
      args.photoTakenAt ?? null,
      now,
      now,
    );
}

describe.skipIf(!HAS_SQLITE)("media albums DB", () => {
  beforeAll(async () => {
    client = await import("./client");
    albums = await import("./media-albums");
    reconciliation = await import("./media-item-reconciliation");
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "emk-albums-"));
    client.initDesktopDatabase(tmpDir);
  });

  afterEach(() => {
    client.__closeDesktopDatabaseForTesting();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("uses manual cover before user star rating before AI aesthetic quality", () => {
    const now = "2026-01-01T00:00:00.000Z";
    const db = client.getDesktopDatabase();
    db.prepare(
      `INSERT INTO media_albums (id, library_id, name, description, created_at, updated_at)
       VALUES ('album-1', ?, 'Summer', NULL, ?, ?)`,
    ).run(LIBRARY_ID, now, now);
    insertMediaItem({ id: "manual", sourcePath: "C:/photos/manual.jpg", starRating: 3, aiQuality: 99 });
    insertMediaItem({ id: "rated", sourcePath: "C:/photos/rated.jpg", starRating: 5, aiQuality: 1 });
    insertMediaItem({ id: "ai", sourcePath: "C:/photos/ai.jpg", starRating: null, aiQuality: 100 });
    albums.addMediaItemsToAlbum("album-1", ["manual", "rated", "ai"]);

    expect(albums.listAlbums().rows[0]?.coverMediaItemId).toBe("rated");

    albums.setAlbumCover("album-1", "manual");
    expect(albums.listAlbums().rows[0]?.coverMediaItemId).toBe("manual");
  });

  it("filters albums by location and YYYY-MM photo date", () => {
    const created = albums.createAlbum("Wakeboard");
    insertMediaItem({
      id: "item-1",
      sourcePath: "C:/photos/lake.jpg",
      starRating: null,
      aiQuality: null,
      city: "Split",
      country: "Croatia",
      photoTakenAt: "2024-06-15",
    });
    albums.addMediaItemsToAlbum(created.id, ["item-1"]);

    expect(
      albums.listAlbums({ locationQuery: "Cro", yearMonthFrom: "2024-06", yearMonthTo: "2024-06" })
        .totalCount,
    ).toBe(1);
    expect(albums.listAlbums({ locationQuery: "Austria" }).totalCount).toBe(0);
  });

  it("filters albums by location against location_area2", () => {
    const created = albums.createAlbum("Coastal");
    insertMediaItem({
      id: "area2-item",
      sourcePath: "C:/photos/coast.jpg",
      starRating: null,
      aiQuality: null,
      country: "USA",
      city: null,
      locationArea: "CA",
      locationArea2: "Big Sur",
    });
    albums.addMediaItemsToAlbum(created.id, ["area2-item"]);
    expect(albums.listAlbums({ locationQuery: "Sur" }).totalCount).toBe(1);
    expect(albums.listAlbums({ locationQuery: "Big" }).totalCount).toBe(1);
  });

  it("filters albums by title and paginates total counts", () => {
    albums.createAlbum("Summer Trip");
    albums.createAlbum("Winter Trip");
    albums.createAlbum("Family");

    const filtered = albums.listAlbums({ titleQuery: "Trip", limit: 1 });
    const secondPage = albums.listAlbums({ titleQuery: "Trip", limit: 1, offset: 1 });

    expect(filtered.totalCount).toBe(2);
    expect(filtered.rows).toHaveLength(1);
    expect(secondPage.totalCount).toBe(2);
    expect(secondPage.rows).toHaveLength(1);
  });

  it("lists album items in position order and excludes deleted media", () => {
    const album = albums.createAlbum("Ordered");
    insertMediaItem({ id: "first", sourcePath: "C:/photos/first.jpg", starRating: null, aiQuality: null });
    insertMediaItem({ id: "deleted", sourcePath: "C:/photos/deleted.jpg", starRating: null, aiQuality: null });
    insertMediaItem({ id: "third", sourcePath: "C:/photos/third.jpg", starRating: null, aiQuality: null });
    albums.addMediaItemsToAlbum(album.id, ["first", "deleted", "third"]);
    client
      .getDesktopDatabase()
      .prepare(`UPDATE media_items SET deleted_at = ? WHERE id = ?`)
      .run("2026-01-02T00:00:00.000Z", "deleted");

    const result = albums.listAlbumItems({ albumId: album.id, limit: 10 });

    expect(result.totalCount).toBe(2);
    expect(result.rows.map((item) => item.id)).toEqual(["first", "third"]);
  });

  it("ignores duplicate and unknown media ids when adding items", () => {
    const album = albums.createAlbum("Deduped");
    insertMediaItem({ id: "known", sourcePath: "C:/photos/known.jpg", starRating: null, aiQuality: null });

    albums.addMediaItemsToAlbum(album.id, ["known", "known", "missing"]);

    expect(albums.listAlbumItems({ albumId: album.id }).rows.map((item) => item.id)).toEqual(["known"]);
  });

  it("deletes album junction rows with the album", () => {
    const album = albums.createAlbum("Delete me");
    const now = "2026-01-01T00:00:00.000Z";
    const db = client.getDesktopDatabase();
    insertMediaItem({ id: "item-delete", sourcePath: "C:/photos/delete.jpg", starRating: null, aiQuality: null });
    albums.addMediaItemsToAlbum(album.id, ["item-delete"]);
    db.prepare(
      `INSERT INTO album_categories (id, library_id, name, parent_id, created_at, updated_at)
       VALUES ('category-1', ?, 'Trips', NULL, ?, ?)`,
    ).run(LIBRARY_ID, now, now);
    db.prepare(
      `INSERT INTO media_album_categories (album_id, category_id, library_id, created_at)
       VALUES (?, 'category-1', ?, ?)`,
    ).run(album.id, LIBRARY_ID, now);
    db.prepare(
      `INSERT INTO media_tags (id, library_id, name, tag_type, created_at, updated_at)
       VALUES ('tag-1', ?, 'Alice', 'person', ?, ?)`,
    ).run(LIBRARY_ID, now, now);
    db.prepare(
      `INSERT INTO media_album_person_tags (album_id, tag_id, library_id, created_at)
       VALUES (?, 'tag-1', ?, ?)`,
    ).run(album.id, LIBRARY_ID, now);

    albums.deleteAlbum(album.id);

    expect(db.prepare(`SELECT COUNT(*) AS cnt FROM media_albums WHERE id = ?`).get(album.id)).toEqual({ cnt: 0 });
    expect(db.prepare(`SELECT COUNT(*) AS cnt FROM media_album_items WHERE media_album_id = ?`).get(album.id)).toEqual({ cnt: 0 });
    expect(db.prepare(`SELECT COUNT(*) AS cnt FROM media_album_categories WHERE album_id = ?`).get(album.id)).toEqual({ cnt: 0 });
    expect(db.prepare(`SELECT COUNT(*) AS cnt FROM media_album_person_tags WHERE album_id = ?`).get(album.id)).toEqual({ cnt: 0 });
  });

  it("clears the manual cover when setting an unknown cover item", () => {
    const album = albums.createAlbum("Cover");
    const db = client.getDesktopDatabase();
    insertMediaItem({ id: "cover-item", sourcePath: "C:/photos/cover.jpg", starRating: null, aiQuality: null });
    albums.addMediaItemsToAlbum(album.id, ["cover-item"]);
    albums.setAlbumCover(album.id, "cover-item");

    albums.setAlbumCover(album.id, "missing-item");

    expect(
      db.prepare(`SELECT cover_media_item_id FROM media_albums WHERE id = ?`).get(album.id),
    ).toEqual({ cover_media_item_id: null });
  });

  it("lists and removes media item album memberships by source path", () => {
    const album = albums.createAlbum("Family");
    insertMediaItem({
      id: "item-membership",
      sourcePath: "C:/photos/family.jpg",
      starRating: null,
      aiQuality: null,
    });
    albums.addMediaItemsToAlbum(album.id, ["C:/photos/family.jpg"]);

    expect(albums.listAlbumsForMediaItem("C:/photos/family.jpg")).toEqual([
      { albumId: album.id, title: "Family" },
    ]);

    albums.removeMediaItemFromAlbum(album.id, "C:/photos/family.jpg");
    expect(albums.listAlbumsForMediaItem("C:/photos/family.jpg")).toEqual([]);
  });

  it("purges album memberships and clears covers for hard-deleted media", () => {
    const album = albums.createAlbum("Purge");
    const db = client.getDesktopDatabase();
    insertMediaItem({ id: "purged-item", sourcePath: "C:/photos/purged.jpg", starRating: null, aiQuality: null });
    albums.addMediaItemsToAlbum(album.id, ["purged-item"]);
    albums.setAlbumCover(album.id, "purged-item");
    db.prepare(`UPDATE media_items SET deleted_at = ? WHERE id = ?`).run(
      "2026-01-02T00:00:00.000Z",
      "purged-item",
    );

    const result = reconciliation.hardPurgeSoftDeletedMediaItemsByIds(["purged-item"]);

    expect(result.purgedAlbumItems).toBe(1);
    expect(db.prepare(`SELECT COUNT(*) AS cnt FROM media_album_items WHERE media_item_id = ?`).get("purged-item")).toEqual({ cnt: 0 });
    expect(db.prepare(`SELECT cover_media_item_id FROM media_albums WHERE id = ?`).get(album.id)).toEqual({
      cover_media_item_id: null,
    });
  });

  it("generates country smart album entries grouped as year > area", () => {
    insertMediaItem({
      id: "rome-2024",
      sourcePath: "C:/photos/rome-2024.jpg",
      starRating: null,
      aiQuality: null,
      city: "Rome",
      country: "Italy",
      locationArea: "Lazio",
      photoTakenAt: "2024-05-01",
    });
    insertMediaItem({
      id: "rome-2025",
      sourcePath: "C:/photos/rome-2025.jpg",
      starRating: null,
      aiQuality: null,
      city: "Rome",
      country: "Italy",
      locationArea: "Lazio",
      photoTakenAt: "2025-05-01",
    });
    insertMediaItem({
      id: "venice-2024",
      sourcePath: "C:/photos/venice-2024.jpg",
      starRating: null,
      aiQuality: null,
      city: "Venice",
      country: "Italy",
      locationArea: "Veneto",
      photoTakenAt: "2024-06-01",
    });

    const result = albums.listSmartAlbumPlaces({ grouping: "year-city", source: "gps" });
    const italy = result.countries.find((country) => country.country === "Italy");
    const year2024 = italy?.groups.find((year) => year.group === "2024");
    const year2025 = italy?.groups.find((year) => year.group === "2025");

    expect(year2024?.entries.map((entry) => entry.label)).toEqual(["Lazio", "Veneto"]);
    expect(year2025?.entries.map((entry) => entry.label)).toEqual(["Lazio"]);
    expect(
      albums.listSmartAlbumItems({
        kind: "place",
        country: "Italy",
        city: "Lazio",
        group: "2024",
        grouping: "year-city",
        source: "gps",
      }).rows.map((item) => item.id),
    ).toEqual(["rome-2024"]);
  });

  it("generates GPS area and temporary non-GPS country smart album variants", () => {
    insertMediaItem({
      id: "provence",
      sourcePath: "C:/photos/provence.jpg",
      starRating: null,
      aiQuality: null,
      city: "Aix-en-Provence",
      country: "France",
      locationArea: "Provence-Alpes-Cote d'Azur",
      photoTakenAt: "2024-06-01",
    });
    insertMediaItem({
      id: "ai-location",
      sourcePath: "C:/photos/ai-location.jpg",
      starRating: null,
      aiQuality: null,
      city: "Barcelona",
      country: "Spain",
      locationArea: "Catalonia",
      locationSource: "ai_vision",
      photoTakenAt: "2024-06-01",
    });

    const gpsArea = albums.listSmartAlbumPlaces({ grouping: "area-city", source: "gps" });
    expect(gpsArea.countries.find((country) => country.country === "France")?.groups[0]?.group).toBe(
      "Provence-Alpes-Cote d'Azur",
    );

    const aiCountries = albums.listSmartAlbumPlaces({ grouping: "year-city", source: "non-gps" });
    expect(aiCountries.countries.map((country) => country.country)).toEqual(["Spain"]);
  });

  it("area-city GPS groups by admin2 (location_area2) with admin1 as groupParent", () => {
    insertMediaItem({
      id: "sf-chinatown",
      sourcePath: "C:/photos/sf.jpg",
      starRating: null,
      aiQuality: null,
      city: "Chinatown",
      country: "United States",
      locationArea: "California",
      locationArea2: "San Francisco County",
      photoTakenAt: "2024-01-01",
    });
    insertMediaItem({
      id: "la-only",
      sourcePath: "C:/photos/la.jpg",
      starRating: null,
      aiQuality: null,
      city: "Los Angeles",
      country: "United States",
      locationArea: "California",
      photoTakenAt: "2024-01-01",
    });

    const result = albums.listSmartAlbumPlaces({ grouping: "area-city", source: "gps" });
    const us = result.countries.find((c) => c.country === "United States");
    const countyGroup = us?.groups.find((g) => g.group === "San Francisco County");
    expect(countyGroup?.groupParent).toBe("California");
    const stateFallbackGroup = us?.groups.find((g) => g.group === "California");
    expect(stateFallbackGroup).toBeDefined();
    expect(stateFallbackGroup?.groupParent ?? null).toBeNull();

    expect(
      albums.listSmartAlbumItems({
        kind: "place",
        country: "United States",
        city: "Chinatown",
        group: "San Francisco County",
        grouping: "area-city",
        source: "gps",
      }).rows.map((item) => item.id),
    ).toEqual(["sf-chinatown"]);
  });

  it("generates country smart album entries grouped as month > area", () => {
    insertMediaItem({
      id: "lazio-2024",
      sourcePath: "C:/photos/lazio-2024.jpg",
      starRating: null,
      aiQuality: null,
      city: "Rome",
      country: "Italy",
      locationArea: "Lazio",
      photoTakenAt: "2024-05-01",
    });
    insertMediaItem({
      id: "lazio-2025",
      sourcePath: "C:/photos/lazio-2025.jpg",
      starRating: null,
      aiQuality: null,
      city: "Rome",
      country: "Italy",
      locationArea: "Lazio",
      photoTakenAt: "2025-06-01",
    });

    const result = albums.listSmartAlbumPlaces({ grouping: "month-area", source: "gps" });
    const italy = result.countries.find((country) => country.country === "Italy");
    const month2024 = italy?.groups.find((group) => group.group === "2024-05");
    const month2025 = italy?.groups.find((group) => group.group === "2025-06");
    expect(month2025?.entries.map((entry) => entry.label)).toEqual(["Lazio"]);
    expect(month2024?.entries.map((entry) => entry.label)).toEqual(["Lazio"]);
    expect(
      albums.listSmartAlbumItems({
        kind: "place",
        country: "Italy",
        city: "Lazio",
        group: "2024-05",
        grouping: "month-area",
        source: "gps",
      }).rows.map((item) => item.id),
    ).toEqual(["lazio-2024"]);
  });

  it("does not consolidate month-area: each YYYY-MM stays a separate group", () => {
    for (let month = 1; month <= 10; month += 1) {
      const monthText = String(month).padStart(2, "0");
      insertMediaItem({
        id: `tuscany-${monthText}`,
        sourcePath: `C:/photos/tuscany-${monthText}.jpg`,
        starRating: null,
        aiQuality: null,
        city: "Florence",
        country: "Italy",
        locationArea: "Tuscany",
        photoTakenAt: `2024-${monthText}-01`,
      });
    }

    const result = albums.listSmartAlbumPlaces({ grouping: "month-area", source: "gps" });
    const italy = result.countries.find((country) => country.country === "Italy");
    const groupKeys = (italy?.groups.map((group) => group.group) ?? []).sort();
    expect(groupKeys).toEqual(
      ["2024-01", "2024-02", "2024-03", "2024-04", "2024-05", "2024-06", "2024-07", "2024-08", "2024-09", "2024-10"],
    );
    expect(
      albums.listSmartAlbumItems({
        kind: "place",
        country: "Italy",
        city: "Tuscany",
        group: "2024-05",
        grouping: "month-area",
        source: "gps",
      }).totalCount,
    ).toBe(1);
  });

  it("excludes document-like, slide/diagram, and screenshot categories from place smart albums", () => {
    insertMediaItem({
      id: "normal-place",
      sourcePath: "C:/photos/normal-place.jpg",
      starRating: 4,
      aiQuality: 8,
      imageCategory: "nature",
      city: "Rome",
      country: "Italy",
      locationArea: "Lazio",
      photoTakenAt: "2024-05-01",
    });
    insertMediaItem({
      id: "doc-place",
      sourcePath: "C:/photos/doc-place.jpg",
      starRating: 5,
      aiQuality: 9,
      imageCategory: "document_other",
      city: "Rome",
      country: "Italy",
      locationArea: "Lazio",
      photoTakenAt: "2024-05-02",
    });
    insertMediaItem({
      id: "screen-place",
      sourcePath: "C:/photos/screen-place.jpg",
      starRating: 5,
      aiQuality: 9,
      imageCategory: "screenshot",
      city: "Rome",
      country: "Italy",
      locationArea: "Lazio",
      photoTakenAt: "2024-05-03",
    });
    insertMediaItem({
      id: "slide-place",
      sourcePath: "C:/photos/slide-place.jpg",
      starRating: 5,
      aiQuality: 9,
      imageCategory: "presentation_slide",
      city: "Rome",
      country: "Italy",
      locationArea: "Lazio",
      photoTakenAt: "2024-05-04",
    });
    insertMediaItem({
      id: "diagram-place",
      sourcePath: "C:/photos/diagram-place.jpg",
      starRating: 5,
      aiQuality: 9,
      imageCategory: "diagram",
      city: "Rome",
      country: "Italy",
      locationArea: "Lazio",
      photoTakenAt: "2024-05-05",
    });

    const places = albums.listSmartAlbumPlaces({ grouping: "year-city", source: "gps" });
    expect(places.countries.find((country) => country.country === "Italy")?.mediaCount).toBe(1);
    expect(
      albums.listSmartAlbumItems({
        kind: "place",
        country: "Italy",
        city: "Lazio",
        group: "2024",
        grouping: "year-city",
        source: "gps",
      }).rows.map((item) => item.id),
    ).toEqual(["normal-place"]);

    const years = albums.listSmartAlbumYears();
    expect(years.years.find((year) => year.year === "2024")?.mediaCount).toBe(1);
    expect(
      albums.listSmartAlbumItems({ kind: "best-of-year", year: "2024" }).rows.map((item) => item.id),
    ).toEqual(["normal-place"]);
  });

  it("generates best-of-year smart albums ordered by rating and AI quality", () => {
    insertMediaItem({
      id: "best-rated",
      sourcePath: "C:/photos/best-rated.jpg",
      starRating: 5,
      aiQuality: 20,
      photoTakenAt: "2024-01-01",
    });
    insertMediaItem({
      id: "best-ai",
      sourcePath: "C:/photos/best-ai.jpg",
      starRating: null,
      aiQuality: 8,
      photoTakenAt: "2024-02-01",
    });
    insertMediaItem({
      id: "excluded-ai",
      sourcePath: "C:/photos/excluded-ai.jpg",
      starRating: null,
      aiQuality: 6,
      photoTakenAt: "2024-03-01",
    });
    insertMediaItem({
      id: "other-year",
      sourcePath: "C:/photos/other-year.jpg",
      starRating: 5,
      aiQuality: 100,
      photoTakenAt: "2023-01-01",
    });

    const years = albums.listSmartAlbumYears();
    const year2024 = years.years.find((year) => year.year === "2024");

    expect(year2024?.mediaCount).toBe(3);
    expect(year2024?.manualRatedCount).toBe(1);
    expect(year2024?.aiRatedCount).toBe(3);
    expect(year2024?.coverSourcePath).toBeNull();
    expect(
      albums.listSmartAlbumItems({ kind: "best-of-year", year: "2024" }).rows.map((item) => item.id),
    ).toEqual(["best-rated", "best-ai", "excluded-ai"]);
  });

  it("includes suggestion-only person matches for best-of-year when includeUnconfirmedFaces is enabled", () => {
    const now = "2026-01-01T00:00:00.000Z";
    insertMediaItem({
      id: "explicit-tag",
      sourcePath: "C:/photos/explicit-tag.jpg",
      starRating: 5,
      aiQuality: 8,
      photoTakenAt: "2024-01-01",
    });
    insertMediaItem({
      id: "suggested-only",
      sourcePath: "C:/photos/suggested-only.jpg",
      starRating: 5,
      aiQuality: 8,
      photoTakenAt: "2024-01-02",
    });
    client
      .getDesktopDatabase()
      .prepare(
        `INSERT INTO media_face_instances (
          id, library_id, media_item_id, source, tag_id, created_at, updated_at
        ) VALUES (?, ?, ?, 'manual', ?, ?, ?)`,
      )
      .run("face-explicit", LIBRARY_ID, "explicit-tag", "person-1", now, now);
    client
      .getDesktopDatabase()
      .prepare(
        `INSERT INTO media_item_person_suggestions (
          library_id, media_item_id, tag_id, best_similarity, exemplar_face_instance_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(LIBRARY_ID, "suggested-only", "person-1", 0.91, null, now);

    expect(
      albums.listSmartAlbumItems({
        kind: "best-of-year",
        year: "2024",
        filters: { personTagIds: ["person-1"] },
      }).rows.map((item) => item.id),
    ).toEqual(["explicit-tag"]);
    expect(
      albums.listSmartAlbumItems({
        kind: "best-of-year",
        year: "2024",
        filters: { personTagIds: ["person-1"], includeUnconfirmedFaces: true },
      }).rows.map((item) => item.id),
    ).toEqual(["suggested-only", "explicit-tag"]);
  });

  it("groups best-of-year rating filters with configurable OR and AND logic", () => {
    insertMediaItem({
      id: "manual-only",
      sourcePath: "C:/photos/manual-only.jpg",
      starRating: 4,
      aiQuality: 2,
      photoTakenAt: "2024-01-01",
    });
    insertMediaItem({
      id: "ai-only",
      sourcePath: "C:/photos/ai-only.jpg",
      starRating: null,
      aiQuality: 8,
      photoTakenAt: "2024-01-02",
    });
    insertMediaItem({
      id: "both",
      sourcePath: "C:/photos/both.jpg",
      starRating: 5,
      aiQuality: 9,
      photoTakenAt: "2024-01-03",
    });

    expect(
      albums.listSmartAlbumItems({
        kind: "best-of-year",
        year: "2024",
        filters: {
          starRatingMin: 4,
          aiAestheticMin: 7,
          ratingLogic: "or",
        },
      }).rows.map((item) => item.id),
    ).toEqual(["both", "manual-only", "ai-only"]);
    expect(
      albums.listSmartAlbumItems({
        kind: "best-of-year",
        year: "2024",
        filters: {
          starRatingMin: 4,
          aiAestheticMin: 7,
          ratingLogic: "and",
        },
      }).rows.map((item) => item.id),
    ).toEqual(["both"]);
  });

  it("caps randomized best-of-year candidates without capping deterministic order", () => {
    for (const index of [1, 2, 3]) {
      insertMediaItem({
        id: `candidate-${index}`,
        sourcePath: `C:/photos/candidate-${index}.jpg`,
        starRating: 5,
        aiQuality: 8,
        photoTakenAt: `2024-01-0${index}`,
      });
    }

    expect(
      albums.listSmartAlbumItems({
        kind: "best-of-year",
        year: "2024",
        randomize: false,
        randomCandidateLimit: 1,
        limit: 10,
      }).rows.map((item) => item.id),
    ).toEqual(["candidate-3", "candidate-2", "candidate-1"]);
    expect(
      albums.listSmartAlbumItems({
        kind: "best-of-year",
        year: "2024",
        randomize: true,
        randomCandidateLimit: 1,
        limit: 10,
      }).rows,
    ).toHaveLength(1);
  });
});

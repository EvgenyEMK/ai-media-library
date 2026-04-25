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

let client!: ClientModule;
let albums!: AlbumsModule;
let tmpDir = "";

function insertMediaItem(args: {
  id: string;
  sourcePath: string;
  starRating: number | null;
  aiQuality: number | null;
  city?: string | null;
  country?: string | null;
  photoTakenAt?: string | null;
}): void {
  const now = "2026-01-01T00:00:00.000Z";
  client
    .getDesktopDatabase()
    .prepare(
      `INSERT INTO media_items (
        id, library_id, source_path, filename, star_rating, ai_metadata,
        city, country, photo_taken_at, media_kind, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'image', ?, ?)`,
    )
    .run(
      args.id,
      LIBRARY_ID,
      args.sourcePath,
      path.basename(args.sourcePath),
      args.starRating,
      args.aiQuality === null
        ? null
        : JSON.stringify({ image_analysis: { photo_estetic_quality: args.aiQuality } }),
      args.city ?? null,
      args.country ?? null,
      args.photoTakenAt ?? null,
      now,
      now,
    );
}

describe.skipIf(!HAS_SQLITE)("media albums DB", () => {
  beforeAll(async () => {
    client = await import("./client");
    albums = await import("./media-albums");
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
});

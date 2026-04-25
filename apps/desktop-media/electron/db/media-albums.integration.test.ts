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
});

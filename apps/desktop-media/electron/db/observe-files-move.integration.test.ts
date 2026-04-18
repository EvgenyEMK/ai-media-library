/**
 * Ensures deferred fs_object tombstoning during metadata prepare allows cross-folder
 * moves to update identity by inode before the source folder marks paths missing.
 *
 * Skipped when better-sqlite3 cannot load (see media-item-duplicate-link.integration.test.ts).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./keyword-search", () => ({
  syncFtsForMediaItem: vi.fn(),
}));

function canOpenSqlite(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require("better-sqlite3") as typeof import("better-sqlite3").default;
    const d = new Database(":memory:");
    d.close();
    return true;
  } catch {
    return false;
  }
}

const HAS_SQLITE = canOpenSqlite();

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_FACE = path.join(HERE, "../../test-assets-local/e2e-photos/face-detect-sample-01.jpg");

const DEFAULT_LIBRARY_ID = "local-default";

type DbMods = {
  __closeDesktopDatabaseForTesting: () => void;
  initDesktopDatabase: typeof import("./client").initDesktopDatabase;
  getDesktopDatabase: typeof import("./client").getDesktopDatabase;
  observeFiles: typeof import("./file-identity").observeFiles;
  finalizeObserveFilesTombstonesForScan: typeof import("./file-identity").finalizeObserveFilesTombstonesForScan;
  upsertMediaItemFromFilePath: typeof import("./media-item-metadata").upsertMediaItemFromFilePath;
};

let dbm!: DbMods;

describe.skipIf(!HAS_SQLITE)("observeFiles + finalize — cross-folder move (integration)", () => {
  let tmpRoot: string;
  let folderA: string;
  let folderB: string;
  let pOther: string;
  let pMovedOld: string;
  let pMovedNew: string;

  beforeAll(async () => {
    const client = await import("./client");
    const fi = await import("./file-identity");
    const meta = await import("./media-item-metadata");
    dbm = {
      __closeDesktopDatabaseForTesting: client.__closeDesktopDatabaseForTesting,
      initDesktopDatabase: client.initDesktopDatabase,
      getDesktopDatabase: client.getDesktopDatabase,
      observeFiles: fi.observeFiles,
      finalizeObserveFilesTombstonesForScan: fi.finalizeObserveFilesTombstonesForScan,
      upsertMediaItemFromFilePath: meta.upsertMediaItemFromFilePath,
    };
  });

  beforeEach(async () => {
    dbm.__closeDesktopDatabaseForTesting();
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "emk-move-scan-"));
    folderA = path.join(tmpRoot, "folder-a");
    folderB = path.join(tmpRoot, "folder-b");
    fs.mkdirSync(folderA);
    fs.mkdirSync(folderB);
    pOther = path.join(folderA, "stays.jpg");
    pMovedOld = path.join(folderA, "moved.jpg");
    pMovedNew = path.join(folderB, "moved.jpg");
    fs.copyFileSync(FIXTURE_FACE, pOther);
    fs.copyFileSync(FIXTURE_FACE, pMovedOld);
    dbm.initDesktopDatabase(tmpRoot);
  });

  afterEach(() => {
    dbm.__closeDesktopDatabaseForTesting();
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("does not tombstone fs_object at old path when source folder runs before destination", async () => {
    const pathMoves: Array<{ from: string; to: string }> = [];

    await dbm.observeFiles(
      [pOther, pMovedOld],
      folderA,
      DEFAULT_LIBRARY_ID,
      undefined,
      undefined,
      (from, to) => pathMoves.push({ from, to }),
      true,
    );

    fs.renameSync(pMovedOld, pMovedNew);

    await dbm.observeFiles(
      [pMovedNew],
      folderB,
      DEFAULT_LIBRARY_ID,
      undefined,
      undefined,
      (from, to) => pathMoves.push({ from, to }),
      true,
    );

    const entriesByFolder = new Map<string, string[]>([
      [folderA, [pOther]],
      [folderB, [pMovedNew]],
    ]);
    dbm.finalizeObserveFilesTombstonesForScan(entriesByFolder, DEFAULT_LIBRARY_ID);

    expect(pathMoves.some((m) => m.from === pMovedOld && m.to === pMovedNew)).toBe(true);

    const db = dbm.getDesktopDatabase();
    const rows = db
      .prepare(
        `SELECT current_path, deleted_at FROM fs_objects WHERE library_id = ? AND deleted_at IS NULL`,
      )
      .all(DEFAULT_LIBRARY_ID) as Array<{ current_path: string; deleted_at: string | null }>;

    const paths = rows.map((r) => path.normalize(r.current_path));
    expect(paths).toContain(path.normalize(pMovedNew));
    expect(paths).not.toContain(path.normalize(pMovedOld));

    await dbm.upsertMediaItemFromFilePath({ filePath: pOther });
    await dbm.upsertMediaItemFromFilePath({ filePath: pMovedNew });

    const mi = db
      .prepare(
        `SELECT source_path, deleted_at FROM media_items WHERE library_id = ? ORDER BY source_path`,
      )
      .all(DEFAULT_LIBRARY_ID) as Array<{ source_path: string; deleted_at: string | null }>;

    const sp = mi.map((r) => path.normalize(r.source_path));
    expect(sp).toContain(path.normalize(pMovedNew));
    expect(sp).not.toContain(path.normalize(pMovedOld));
    expect(mi.every((r) => r.deleted_at == null)).toBe(true);
  });
});

/**
 * Integration tests using a real SQLite DB (better-sqlite3).
 *
 * Vitest’s Node version may differ from the one used to compile the native module
 * (e.g. Electron vs system Node). When `better-sqlite3` fails to load, this suite is skipped.
 * Run with a matching Node after `pnpm run rebuild:native`, or run metadata scans in the app.
 *
 * This file must not statically import `./client` or `better-sqlite3`: loading the test file would
 * throw before `describe.skipIf` can skip the suite.
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
    const Database = require("better-sqlite3") as new (path: string) => { close: () => void };
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
const FIXTURE_ID = path.join(HERE, "../../test-assets-local/e2e-photos/Croatian_ID_card_specimen.jpg");

/** Same synthetic hash for two different files simulates duplicate detection by strong hash (identical bytes in real scans). */
const SHARED_HASH = `${"aa".repeat(32)}`;

/** Must match `DEFAULT_LIBRARY_ID` in `folder-analysis-status.ts` (do not import that module here — it loads `./client`). */
const DEFAULT_LIBRARY_ID = "local-default";

type DbModules = {
  __closeDesktopDatabaseForTesting: () => void;
  getDesktopDatabase: typeof import("./client").getDesktopDatabase;
  initDesktopDatabase: typeof import("./client").initDesktopDatabase;
  upsertMediaItemFromFilePath: typeof import("./media-item-metadata").upsertMediaItemFromFilePath;
  reconcileFolder: typeof import("./media-item-reconciliation").reconcileFolder;
};

let dbm!: DbModules;

function observedForPath(filePath: string, strongHash: string): import("./file-identity").ObservedFileState {
  const st = fs.statSync(filePath);
  return {
    currentPath: filePath,
    fileSize: st.size,
    mtimeMs: Math.trunc(st.mtimeMs),
    ctimeMs: Math.trunc(st.ctimeMs),
    quickFingerprint: `${st.size}:${Math.trunc(st.mtimeMs)}`,
    strongHash,
    duplicateGroupId: null,
    lastSeenAt: new Date().toISOString(),
  };
}

describe.skipIf(!HAS_SQLITE)("upsertMediaItemFromFilePath — duplicate content / folder churn (integration)", () => {
  let tmpDir: string;

  beforeAll(async () => {
    const client = await import("./client");
    const meta = await import("./media-item-metadata");
    const recon = await import("./media-item-reconciliation");
    dbm = {
      __closeDesktopDatabaseForTesting: client.__closeDesktopDatabaseForTesting,
      getDesktopDatabase: client.getDesktopDatabase,
      initDesktopDatabase: client.initDesktopDatabase,
      upsertMediaItemFromFilePath: meta.upsertMediaItemFromFilePath,
      reconcileFolder: recon.reconcileFolder,
    };
  });

  beforeEach(() => {
    dbm.__closeDesktopDatabaseForTesting();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "emk-media-meta-"));
    dbm.initDesktopDatabase(tmpDir);
  });

  afterEach(() => {
    dbm.__closeDesktopDatabaseForTesting();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("creates two distinct media_items rows when the same bytes exist under two paths (copy in folder)", async () => {
    const p1 = path.join(tmpDir, "face-detect-sample-01.jpg");
    const p2 = path.join(tmpDir, "face-detect-sample-01 - Copy.jpg");
    fs.copyFileSync(FIXTURE_FACE, p1);
    fs.copyFileSync(FIXTURE_FACE, p2);

    const r1 = await dbm.upsertMediaItemFromFilePath({
      filePath: p1,
      observedState: observedForPath(p1, SHARED_HASH),
    });
    const r2 = await dbm.upsertMediaItemFromFilePath({
      filePath: p2,
      observedState: observedForPath(p2, SHARED_HASH),
    });

    expect(r1.status).toBe("created");
    expect(r2.status).toBe("created");
    expect(r1.mediaItemId).toBeTruthy();
    expect(r2.mediaItemId).toBeTruthy();
    expect(r1.mediaItemId).not.toBe(r2.mediaItemId);

    expect(r1.needsAiPipelineFollowUp).toBe(true);
    expect(r2.needsAiPipelineFollowUp).toBe(false);

    const db = dbm.getDesktopDatabase();
    const rows = db
      .prepare(
        `SELECT id, source_path, content_hash
         FROM media_items
         WHERE library_id = ? AND deleted_at IS NULL AND source_path IN (?, ?)
         ORDER BY source_path`,
      )
      .all(DEFAULT_LIBRARY_ID, p1, p2) as Array<{ id: string; source_path: string; content_hash: string | null }>;

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.content_hash === SHARED_HASH)).toBe(true);
  });

  it("creates three rows for three paths sharing one content hash (no UNIQUE id errors)", async () => {
    const paths = [
      path.join(tmpDir, "a.jpg"),
      path.join(tmpDir, "b.jpg"),
      path.join(tmpDir, "c.jpg"),
    ];
    for (const p of paths) {
      fs.copyFileSync(FIXTURE_FACE, p);
    }

    const ids = new Set<string>();
    for (const p of paths) {
      const r = await dbm.upsertMediaItemFromFilePath({
        filePath: p,
        observedState: observedForPath(p, SHARED_HASH),
      });
      expect(r.status).toBe("created");
      expect(r.status).not.toBe("failed");
      expect(r.mediaItemId).toBeTruthy();
      ids.add(r.mediaItemId!);
    }
    expect(ids.size).toBe(3);
  });

  it("treats different files with different hashes as independent creates (mixed folder)", async () => {
    const p1 = path.join(tmpDir, "Croatian_ID_card_specimen.jpg");
    const p2 = path.join(tmpDir, "face-detect-sample-01.jpg");
    fs.copyFileSync(FIXTURE_ID, p1);
    fs.copyFileSync(FIXTURE_FACE, p2);

    const hash1 = `${"bb".repeat(32)}`;
    const hash2 = `${"cc".repeat(32)}`;

    const r1 = await dbm.upsertMediaItemFromFilePath({
      filePath: p1,
      observedState: observedForPath(p1, hash1),
    });
    const r2 = await dbm.upsertMediaItemFromFilePath({
      filePath: p2,
      observedState: observedForPath(p2, hash2),
    });

    expect(r1.status).toBe("created");
    expect(r2.status).toBe("created");
    expect(r1.mediaItemId).not.toBe(r2.mediaItemId);
  });

  it("updates the same path when content hash changes (replaced file, same name)", async () => {
    const p = path.join(tmpDir, "slot.jpg");
    fs.copyFileSync(FIXTURE_FACE, p);
    const hashA = `${"dd".repeat(32)}`;
    const hashB = `${"ee".repeat(32)}`;

    const r1 = await dbm.upsertMediaItemFromFilePath({
      filePath: p,
      observedState: observedForPath(p, hashA),
    });
    expect(r1.status).toBe("created");
    const id1 = r1.mediaItemId;

    fs.copyFileSync(FIXTURE_ID, p);
    const st = fs.statSync(p);
    const r2 = await dbm.upsertMediaItemFromFilePath({
      filePath: p,
      observedState: {
        ...observedForPath(p, hashB),
        fileSize: st.size,
        mtimeMs: Math.trunc(st.mtimeMs),
        ctimeMs: Math.trunc(st.ctimeMs),
        quickFingerprint: `${st.size}:${Math.trunc(st.mtimeMs)}`,
      },
    });

    expect(r2.status).toBe("updated");
    expect(r2.mediaItemId).toBe(id1);

    const db = dbm.getDesktopDatabase();
    const row = db
      .prepare(`SELECT content_hash FROM media_items WHERE library_id = ? AND source_path = ?`)
      .get(DEFAULT_LIBRARY_ID, p) as { content_hash: string | null };
    expect(row.content_hash).toBe(hashB);
  });

  it("soft-deletes catalog rows when reconcile sees files removed from disk", async () => {
    const p1 = path.join(tmpDir, "keep.jpg");
    const p2 = path.join(tmpDir, "gone.jpg");
    fs.copyFileSync(FIXTURE_FACE, p1);
    fs.copyFileSync(FIXTURE_FACE, p2);

    await dbm.upsertMediaItemFromFilePath({
      filePath: p1,
      observedState: observedForPath(p1, SHARED_HASH),
    });
    await dbm.upsertMediaItemFromFilePath({
      filePath: p2,
      observedState: observedForPath(p2, SHARED_HASH),
    });

    fs.unlinkSync(p2);

    const rec = dbm.reconcileFolder(tmpDir, new Set([p1]));
    expect(rec.softDeleted).toBe(1);
    expect(rec.resurrected).toBe(0);

    const db = dbm.getDesktopDatabase();
    const gone = db
      .prepare(`SELECT deleted_at FROM media_items WHERE library_id = ? AND source_path = ?`)
      .get(DEFAULT_LIBRARY_ID, p2) as { deleted_at: string | null };
    expect(gone.deleted_at).toBeTruthy();
  });

  it("after one duplicate path is soft-deleted, a new copy path still upserts without id collision", async () => {
    const p1 = path.join(tmpDir, "a.jpg");
    const p2 = path.join(tmpDir, "b.jpg");
    fs.copyFileSync(FIXTURE_FACE, p1);
    fs.copyFileSync(FIXTURE_FACE, p2);

    await dbm.upsertMediaItemFromFilePath({
      filePath: p1,
      observedState: observedForPath(p1, SHARED_HASH),
    });
    await dbm.upsertMediaItemFromFilePath({
      filePath: p2,
      observedState: observedForPath(p2, SHARED_HASH),
    });

    fs.unlinkSync(p2);
    dbm.reconcileFolder(tmpDir, new Set([p1]));

    const p3 = path.join(tmpDir, "c.jpg");
    fs.copyFileSync(FIXTURE_FACE, p3);

    const r3 = await dbm.upsertMediaItemFromFilePath({
      filePath: p3,
      observedState: observedForPath(p3, SHARED_HASH),
    });

    expect(r3.status).toBe("created");
    expect(r3.mediaItemId).toBeTruthy();

    const db = dbm.getDesktopDatabase();
    const active = db
      .prepare(
        `SELECT id FROM media_items WHERE library_id = ? AND deleted_at IS NULL AND content_hash = ? ORDER BY source_path`,
      )
      .all(DEFAULT_LIBRARY_ID, SHARED_HASH) as Array<{ id: string }>;

    expect(active).toHaveLength(2);
    expect(new Set(active.map((r) => r.id)).size).toBe(2);
  });
});

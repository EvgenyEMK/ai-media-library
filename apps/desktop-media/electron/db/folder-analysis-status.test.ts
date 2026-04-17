import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FolderRow {
  library_id: string;
  folder_path: string;
  photo_in_progress: number;
  face_in_progress: number;
  semantic_in_progress: number;
  last_updated_at: string;
}

class FakeDb {
  rows: FolderRow[] = [];

  transaction<T extends (...args: never[]) => void>(fn: T): T {
    return fn;
  }

  prepare(sql: string): { all: (...args: unknown[]) => unknown[]; run: (...args: unknown[]) => { changes: number } } {
    if (sql.includes("SELECT folder_path") && sql.includes("folder_path = ? OR folder_path LIKE ?")) {
      return {
        all: (...args: unknown[]) => {
          const [libraryId, exact, like] = args as [string, string, string];
          const likePrefix = like.slice(0, -1);
          return this.rows
            .filter(
              (row) =>
                row.library_id === libraryId &&
                (row.folder_path === exact || row.folder_path.startsWith(likePrefix)),
            )
            .map((row) => ({ folder_path: row.folder_path }));
        },
        run: () => ({ changes: 0 }),
      };
    }
    if (sql.includes("DELETE FROM folder_analysis_status")) {
      return {
        all: () => [],
        run: (...args: unknown[]) => {
          const [libraryId, folderPath] = args as [string, string];
          const before = this.rows.length;
          this.rows = this.rows.filter(
            (row) => !(row.library_id === libraryId && row.folder_path === folderPath),
          );
          return { changes: before - this.rows.length };
        },
      };
    }
    if (sql.includes("SET photo_in_progress = 0")) {
      return {
        all: () => [],
        run: (...args: unknown[]) => {
          const [now, libraryId] = args as [string, string];
          let changes = 0;
          for (const row of this.rows) {
            if (row.library_id !== libraryId) continue;
            if (row.photo_in_progress || row.face_in_progress || row.semantic_in_progress) {
              row.photo_in_progress = 0;
              row.face_in_progress = 0;
              row.semantic_in_progress = 0;
              row.last_updated_at = now;
              changes += 1;
            }
          }
          return { changes };
        },
      };
    }
    if (sql.includes("SET last_updated_at = ?") && sql.includes("folder_path = ?")) {
      return {
        all: () => [],
        run: (...args: unknown[]) => {
          const [now, libraryId, folderPath] = args as [string, string, string];
          let changes = 0;
          for (const row of this.rows) {
            if (row.library_id === libraryId && row.folder_path === folderPath) {
              row.last_updated_at = now;
              changes += 1;
            }
          }
          return { changes };
        },
      };
    }
    throw new Error(`Unsupported SQL in test double: ${sql}`);
  }
}

let db: FakeDb;

vi.mock("./client", () => ({
  getDesktopDatabase: () => db,
}));

import {
  clearAllInProgressFlags,
  pruneFolderAnalysisStatusesForMissingChildren,
  pruneFolderAnalysisStatusesNotInSet,
} from "./folder-analysis-status";

function insertStatusRow(folderPath: string, opts?: { photo?: number; face?: number; semantic?: number }): void {
  db.rows.push({
    library_id: "local-default",
    folder_path: folderPath,
    photo_in_progress: opts?.photo ?? 0,
    face_in_progress: opts?.face ?? 0,
    semantic_in_progress: opts?.semantic ?? 0,
    last_updated_at: "2026-01-01T00:00:00.000Z",
  });
}

describe("folder-analysis-status cleanup helpers", () => {
  beforeEach(() => {
    db = new FakeDb();
  });

  afterEach(() => {
    db.rows = [];
  });

  it("clears all persisted in-progress flags", () => {
    insertStatusRow(path.join("C:", "lib", "a"), { photo: 1 });
    insertStatusRow(path.join("C:", "lib", "b"), { face: 1 });
    insertStatusRow(path.join("C:", "lib", "c"), { semantic: 1 });
    insertStatusRow(path.join("C:", "lib", "d"));

    const changed = clearAllInProgressFlags();

    expect(changed).toBe(3);
    const rows = db.rows
      .slice()
      .sort((a, b) => a.folder_path.localeCompare(b.folder_path))
      .map((r) => ({
        photo_in_progress: r.photo_in_progress,
        face_in_progress: r.face_in_progress,
        semantic_in_progress: r.semantic_in_progress,
      }));
    expect(rows).toEqual([
      { photo_in_progress: 0, face_in_progress: 0, semantic_in_progress: 0 },
      { photo_in_progress: 0, face_in_progress: 0, semantic_in_progress: 0 },
      { photo_in_progress: 0, face_in_progress: 0, semantic_in_progress: 0 },
      { photo_in_progress: 0, face_in_progress: 0, semantic_in_progress: 0 },
    ]);
  });

  it("prunes rows under root that are absent from keep set", () => {
    const root = path.join("C:", "lib", "root");
    const keep = path.join(root, "kept");
    const remove = path.join(root, "removed");
    insertStatusRow(root);
    insertStatusRow(keep);
    insertStatusRow(path.join(keep, "child"));
    insertStatusRow(remove);
    insertStatusRow(path.join(remove, "nested"));
    insertStatusRow(path.join("C:", "lib", "outside"));

    const removedCount = pruneFolderAnalysisStatusesNotInSet(root, [root, keep, path.join(keep, "child")]);

    expect(removedCount).toBe(2);
    const paths = db.rows
      .slice()
      .sort((a, b) => a.folder_path.localeCompare(b.folder_path))
      .map((r) => r.folder_path);
    expect(paths).toEqual([
      path.join("C:", "lib", "outside"),
      root,
      keep,
      path.join(keep, "child"),
    ]);
  });

  it("prunes missing direct-child subtrees for parent path", () => {
    const parent = path.join("C:", "lib", "parent");
    const childA = path.join(parent, "a");
    const childB = path.join(parent, "b");
    const childC = path.join(parent, "c");
    insertStatusRow(parent);
    insertStatusRow(childA);
    insertStatusRow(path.join(childA, "nested"));
    insertStatusRow(childB);
    insertStatusRow(path.join(childB, "nested"));
    insertStatusRow(childC);

    const removedCount = pruneFolderAnalysisStatusesForMissingChildren(parent, [childA, childC]);

    expect(removedCount).toBe(2);
    const paths = db.rows
      .slice()
      .sort((a, b) => a.folder_path.localeCompare(b.folder_path))
      .map((r) => r.folder_path);
    expect(paths).toEqual([parent, childA, path.join(childA, "nested"), childC]);
  });
});

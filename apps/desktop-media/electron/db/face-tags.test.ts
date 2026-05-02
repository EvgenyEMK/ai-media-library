import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createPersonTag,
  deletePersonTag,
  getPersonTagDeleteUsage,
  listPersonTagsWithFaceCounts,
  updatePersonTagBirthDate,
} from "./face-tags";

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

let client!: typeof import("./client");
let tmpDir = "";

describe.skipIf(!HAS_SQLITE)("face-tags — birth_date", () => {
  beforeAll(async () => {
    client = await import("./client");
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "emk-face-tags-"));
    client.initDesktopDatabase(tmpDir);
  });

  afterEach(() => {
    client.__closeDesktopDatabaseForTesting();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trips birth date on create and clear via update", () => {
    const created = createPersonTag("Alex", undefined, "1995-03-15");
    expect(created.birthDate).toBe("1995-03-15");

    const listed = listPersonTagsWithFaceCounts();
    expect(listed.find((t) => t.id === created.id)?.birthDate).toBe("1995-03-15");

    const cleared = updatePersonTagBirthDate(created.id, null);
    expect(cleared.birthDate).toBe(null);

    const listedAfter = listPersonTagsWithFaceCounts();
    expect(listedAfter.find((t) => t.id === created.id)?.birthDate).toBe(null);
  });

  it("updates birth date", () => {
    const created = createPersonTag("Blair");
    expect(created.birthDate).toBe(null);

    const updated = updatePersonTagBirthDate(created.id, "2000-01-02");
    expect(updated.birthDate).toBe("2000-01-02");
  });

  it("reports usage and removes face/group links when deleting", () => {
    const person = createPersonTag("Casey");
    const db = client.getDesktopDatabase();
    const now = "2026-01-01T00:00:00.000Z";

    db.prepare(
      `INSERT INTO media_items (
        id, library_id, source_path, filename, media_kind, created_at, updated_at
      ) VALUES (?, 'local-default', ?, ?, 'image', ?, ?)`,
    ).run("media-1", "C:/photos/casey.jpg", "casey.jpg", now, now);
    db.prepare(
      `INSERT INTO media_face_instances (
        id, library_id, media_item_id, tag_id, source, created_at, updated_at
      ) VALUES (?, 'local-default', ?, ?, 'auto', ?, ?)`,
    ).run("face-1", "media-1", person.id, now, now);
    db.prepare(
      `INSERT INTO person_groups (id, library_id, name, created_at)
       VALUES (?, 'local-default', 'Family', ?)`,
    ).run("group-1", now);
    db.prepare(
      `INSERT INTO person_tag_groups (tag_id, group_id, library_id, created_at)
       VALUES (?, ?, 'local-default', ?)`,
    ).run(person.id, "group-1", now);

    expect(getPersonTagDeleteUsage(person.id)).toMatchObject({
      tagId: person.id,
      label: "Casey",
      faceCount: 1,
      mediaItemCount: 1,
    });

    expect(deletePersonTag(person.id)).toBe(true);

    const face = db
      .prepare(`SELECT tag_id FROM media_face_instances WHERE id = 'face-1'`)
      .get() as { tag_id: string | null };
    const groupLink = db
      .prepare(`SELECT COUNT(*) AS c FROM person_tag_groups WHERE tag_id = ?`)
      .get(person.id) as { c: number };
    expect(face.tag_id).toBe(null);
    expect(groupLink.c).toBe(0);
    expect(listPersonTagsWithFaceCounts().some((tag) => tag.id === person.id)).toBe(false);
  });
});

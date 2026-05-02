import { randomUUID } from "node:crypto";
import type { DesktopPersonGroup, DesktopPersonTag } from "../../src/shared/ipc";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";

export function listPersonGroups(libraryId = DEFAULT_LIBRARY_ID): DesktopPersonGroup[] {
  const db = getDesktopDatabase();
  const rows = db
    .prepare(
      `SELECT id, name FROM person_groups
       WHERE library_id = ?
       ORDER BY name COLLATE NOCASE ASC`,
    )
    .all(libraryId) as Array<{ id: string; name: string }>;
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

export function createPersonGroup(
  name: string,
  libraryId = DEFAULT_LIBRARY_ID,
): DesktopPersonGroup {
  const db = getDesktopDatabase();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Group name is required.");
  }
  const now = new Date().toISOString();
  const id = randomUUID();
  try {
    db.prepare(
      `INSERT INTO person_groups (id, library_id, name, created_at)
       VALUES (?, ?, ?, ?)`,
    ).run(id, libraryId, trimmed, now);
  } catch {
    const existing = db
      .prepare(
        `SELECT id, name FROM person_groups
         WHERE library_id = ? AND LOWER(name) = LOWER(?)
         LIMIT 1`,
      )
      .get(libraryId, trimmed) as { id: string; name: string } | undefined;
    if (existing) {
      return { id: existing.id, name: existing.name };
    }
    throw new Error("Could not create person group.");
  }
  return { id, name: trimmed };
}

export function renamePersonGroup(
  groupId: string,
  name: string,
  libraryId = DEFAULT_LIBRARY_ID,
): DesktopPersonGroup {
  const db = getDesktopDatabase();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Group name is required.");
  }
  const exists = db
    .prepare(`SELECT id FROM person_groups WHERE id = ? AND library_id = ?`)
    .get(groupId, libraryId) as { id: string } | undefined;
  if (!exists) {
    throw new Error("Group not found.");
  }
  const conflict = db
    .prepare(
      `SELECT id FROM person_groups
       WHERE library_id = ? AND LOWER(name) = LOWER(?) AND id != ?
       LIMIT 1`,
    )
    .get(libraryId, trimmed, groupId) as { id: string } | undefined;
  if (conflict) {
    throw new Error("A group with this name already exists.");
  }
  db.prepare(`UPDATE person_groups SET name = ? WHERE id = ? AND library_id = ?`).run(
    trimmed,
    groupId,
    libraryId,
  );
  return { id: groupId, name: trimmed };
}

export function deletePersonGroup(groupId: string, libraryId = DEFAULT_LIBRARY_ID): void {
  const db = getDesktopDatabase();
  const row = db
    .prepare(`SELECT id FROM person_groups WHERE id = ? AND library_id = ?`)
    .get(groupId, libraryId) as { id: string } | undefined;
  if (!row) {
    throw new Error("Group not found.");
  }
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM person_tag_groups WHERE group_id = ? AND library_id = ?`).run(
      groupId,
      libraryId,
    );
    db.prepare(`DELETE FROM person_groups WHERE id = ? AND library_id = ?`).run(groupId, libraryId);
  });
  tx();
}

export function listPersonTagsInGroup(
  groupId: string,
  libraryId = DEFAULT_LIBRARY_ID,
): DesktopPersonTag[] {
  const db = getDesktopDatabase();
  const rows = db
    .prepare(
      `SELECT mt.id, mt.name, COALESCE(mt.pinned, 0) AS pinned, mt.birth_date
       FROM media_tags mt
       INNER JOIN person_tag_groups ptg
         ON ptg.tag_id = mt.id AND ptg.library_id = mt.library_id
       WHERE ptg.group_id = ?
         AND ptg.library_id = ?
         AND mt.tag_type = 'person'
       ORDER BY COALESCE(mt.pinned, 0) DESC, mt.name COLLATE NOCASE ASC`,
    )
    .all(groupId, libraryId) as Array<{
    id: string;
    name: string;
    pinned: number;
    birth_date: string | null;
  }>;
  return rows.map((r) => ({
    id: r.id,
    label: r.name,
    pinned: r.pinned === 1,
    birthDate: r.birth_date ?? null,
  }));
}

export function setPersonTagGroups(
  tagId: string,
  groupIds: string[],
  libraryId = DEFAULT_LIBRARY_ID,
): void {
  const db = getDesktopDatabase();
  const unique = Array.from(new Set(groupIds));
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM person_tag_groups WHERE tag_id = ? AND library_id = ?`).run(
      tagId,
      libraryId,
    );
    const insert = db.prepare(
      `INSERT INTO person_tag_groups (tag_id, group_id, library_id, created_at)
       VALUES (?, ?, ?, ?)`,
    );
    for (const groupId of unique) {
      const exists = db
        .prepare(`SELECT 1 FROM person_groups WHERE id = ? AND library_id = ?`)
        .get(groupId, libraryId);
      if (exists) {
        insert.run(tagId, groupId, libraryId, now);
      }
    }
  });
  tx();
}

export function getPersonTagGroupsMap(
  tagIds: string[],
  libraryId = DEFAULT_LIBRARY_ID,
): Record<string, DesktopPersonGroup[]> {
  const out: Record<string, DesktopPersonGroup[]> = {};
  if (tagIds.length === 0) {
    return out;
  }
  const uniqueTagIds = Array.from(new Set(tagIds));
  for (const id of uniqueTagIds) {
    out[id] = [];
  }
  const db = getDesktopDatabase();
  const placeholders = uniqueTagIds.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT ptg.tag_id, pg.id AS group_id, pg.name AS group_name
       FROM person_tag_groups ptg
       INNER JOIN person_groups pg
         ON pg.id = ptg.group_id AND pg.library_id = ptg.library_id
       WHERE ptg.library_id = ?
         AND ptg.tag_id IN (${placeholders})
       ORDER BY pg.name COLLATE NOCASE ASC`,
    )
    .all(libraryId, ...uniqueTagIds) as Array<{
    tag_id: string;
    group_id: string;
    group_name: string;
  }>;

  for (const row of rows) {
    const list = out[row.tag_id];
    if (list) {
      list.push({ id: row.group_id, name: row.group_name });
    }
  }
  return out;
}

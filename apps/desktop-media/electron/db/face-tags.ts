import { randomUUID } from "node:crypto";
import { getPeopleBoundingBoxes, mergeMetadataV2, type MediaMetadata } from "@emk/media-metadata-core";
import type { DesktopPersonTag } from "../../src/shared/ipc";
import { getDesktopDatabase } from "./client";
import { FACE_BBOX_REF_HEIGHT_SQL, FACE_BBOX_REF_WIDTH_SQL } from "./face-instance-display-dimensions";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";

function normalizeBirthDate(input: unknown): string | null {
  if (input === null || input === undefined) {
    return null;
  }
  if (typeof input !== "string") {
    throw new Error("Birth date must be YYYY-MM-DD.");
  }
  const trimmed = input.trim();
  if (trimmed === "") {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    throw new Error("Birth date must be YYYY-MM-DD.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Birth date must be YYYY-MM-DD.");
  }
  return trimmed;
}

function rowToDesktopPersonTag(row: {
  id: string;
  name: string;
  pinned: number;
  birth_date: string | null | undefined;
}): DesktopPersonTag {
  return {
    id: row.id,
    label: row.name,
    pinned: row.pinned === 1,
    birthDate: row.birth_date ?? null,
  };
}

export interface DesktopFaceInstance {
  id: string;
  media_item_id: string;
  face_index: number;
  type: "auto";
  confidence: number | null;
  tag_id: string | null;
  tag: DesktopPersonTag | null;
  bounding_box: {
    x: number | null;
    y: number | null;
    width: number | null;
    height: number | null;
  };
  /** Pixel width bbox coordinates use (COALESCE(bbox_ref_width, media width)). */
  ref_image_width: number | null;
  /** Pixel height bbox coordinates use (COALESCE(bbox_ref_height, media height)). */
  ref_image_height: number | null;
  landmarks_5: Array<[number, number]> | null;
  embedding_status: string | null;
  cluster_id: string | null;
  crop_path: string | null;
  estimated_age_years: number | null;
  estimated_gender: string | null;
  age_gender_confidence: number | null;
  age_gender_model: string | null;
}

export function listPersonTags(libraryId = DEFAULT_LIBRARY_ID): DesktopPersonTag[] {
  const db = getDesktopDatabase();
  const rows = db
    .prepare(
      `SELECT id, name, COALESCE(pinned, 0) AS pinned, birth_date
       FROM media_tags
       WHERE library_id = ?
         AND tag_type = 'person'
       ORDER BY COALESCE(pinned, 0) DESC, name COLLATE NOCASE ASC`,
    )
    .all(libraryId) as Array<{ id: string; name: string; pinned: number; birth_date: string | null }>;

  return rows.map((row) => rowToDesktopPersonTag(row));
}

export function createPersonTag(
  label: string,
  libraryId = DEFAULT_LIBRARY_ID,
  birthDate?: string | null,
): DesktopPersonTag {
  const db = getDesktopDatabase();
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("Person tag label is required.");
  }
  const normalizedBirth = normalizeBirthDate(birthDate);

  const existing = db
    .prepare(
      `SELECT id, name
       FROM media_tags
       WHERE library_id = ?
         AND tag_type = 'person'
         AND LOWER(name) = LOWER(?)
       LIMIT 1`,
    )
    .get(libraryId, trimmed) as { id: string; name: string } | undefined;
  if (existing) {
    const row = db
      .prepare(
        `SELECT id, name, COALESCE(pinned, 0) AS pinned, birth_date
         FROM media_tags WHERE id = ? AND library_id = ? LIMIT 1`,
      )
      .get(existing.id, libraryId) as
      | { id: string; name: string; pinned: number; birth_date: string | null }
      | undefined;
    if (!row) {
      throw new Error("Person tag not found.");
    }
    return rowToDesktopPersonTag(row);
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO media_tags (
      id,
      library_id,
      name,
      tag_type,
      birth_date,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, 'person', ?, ?, ?)`,
  ).run(id, libraryId, trimmed, normalizedBirth, now, now);

  return { id, label: trimmed, pinned: false, birthDate: normalizedBirth };
}

export function updatePersonTagLabel(
  tagId: string,
  label: string,
  libraryId = DEFAULT_LIBRARY_ID,
): DesktopPersonTag {
  const db = getDesktopDatabase();
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("Person tag label is required.");
  }

  const existing = db
    .prepare(
      `SELECT id, name
       FROM media_tags
       WHERE id = ? AND library_id = ? AND tag_type = 'person'
       LIMIT 1`,
    )
    .get(tagId, libraryId) as { id: string; name: string } | undefined;
  if (!existing) {
    throw new Error("Person tag not found.");
  }

  const conflict = db
    .prepare(
      `SELECT id
       FROM media_tags
       WHERE library_id = ?
         AND tag_type = 'person'
         AND LOWER(name) = LOWER(?)
         AND id != ?
       LIMIT 1`,
    )
    .get(libraryId, trimmed, tagId) as { id: string } | undefined;
  if (conflict) {
    throw new Error("A person tag with this name already exists.");
  }

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE media_tags
     SET name = ?, updated_at = ?
     WHERE id = ? AND library_id = ?`,
  ).run(trimmed, now, tagId, libraryId);

  const after = db
    .prepare(
      `SELECT id, name, COALESCE(pinned, 0) AS pinned, birth_date
       FROM media_tags
       WHERE id = ? AND library_id = ?
       LIMIT 1`,
    )
    .get(tagId, libraryId) as { id: string; name: string; pinned: number; birth_date: string | null };

  return rowToDesktopPersonTag(after);
}

export function updatePersonTagBirthDate(
  tagId: string,
  birthDate: unknown,
  libraryId = DEFAULT_LIBRARY_ID,
): DesktopPersonTag {
  const db = getDesktopDatabase();
  const normalized = normalizeBirthDate(birthDate);

  const existing = db
    .prepare(
      `SELECT id, name
       FROM media_tags
       WHERE id = ? AND library_id = ? AND tag_type = 'person'
       LIMIT 1`,
    )
    .get(tagId, libraryId) as { id: string; name: string } | undefined;
  if (!existing) {
    throw new Error("Person tag not found.");
  }

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE media_tags
     SET birth_date = ?, updated_at = ?
     WHERE id = ? AND library_id = ?`,
  ).run(normalized, now, tagId, libraryId);

  const after = db
    .prepare(
      `SELECT id, name, COALESCE(pinned, 0) AS pinned, birth_date
       FROM media_tags
       WHERE id = ? AND library_id = ?
       LIMIT 1`,
    )
    .get(tagId, libraryId) as { id: string; name: string; pinned: number; birth_date: string | null };

  return rowToDesktopPersonTag(after);
}

export function setPersonTagPinned(
  tagId: string,
  pinned: boolean,
  libraryId = DEFAULT_LIBRARY_ID,
): DesktopPersonTag {
  const db = getDesktopDatabase();
  const existing = db
    .prepare(
      `SELECT id, name
       FROM media_tags
       WHERE id = ? AND library_id = ? AND tag_type = 'person'
       LIMIT 1`,
    )
    .get(tagId, libraryId) as { id: string; name: string } | undefined;
  if (!existing) {
    throw new Error("Person tag not found.");
  }

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE media_tags
     SET pinned = ?, updated_at = ?
     WHERE id = ? AND library_id = ?`,
  ).run(pinned ? 1 : 0, now, tagId, libraryId);

  const after = db
    .prepare(
      `SELECT id, name, COALESCE(pinned, 0) AS pinned, birth_date
       FROM media_tags
       WHERE id = ? AND library_id = ?
       LIMIT 1`,
    )
    .get(tagId, libraryId) as { id: string; name: string; pinned: number; birth_date: string | null };

  return rowToDesktopPersonTag(after);
}

export interface PersonTagDeleteUsage {
  tagId: string;
  label: string;
  faceCount: number;
  mediaItemCount: number;
}

export function getPersonTagDeleteUsage(
  tagId: string,
  libraryId = DEFAULT_LIBRARY_ID,
): PersonTagDeleteUsage {
  const db = getDesktopDatabase();
  const tag = db
    .prepare(
      `SELECT id, name
       FROM media_tags
       WHERE id = ? AND library_id = ? AND tag_type = 'person'
       LIMIT 1`,
    )
    .get(tagId, libraryId) as { id: string; name: string } | undefined;
  if (!tag) {
    throw new Error("Person tag not found.");
  }

  const row = db
    .prepare(
      `SELECT
         COUNT(fi.id) AS face_count,
         COUNT(DISTINCT fi.media_item_id) AS media_item_count
       FROM media_face_instances fi
       INNER JOIN media_items mi
         ON mi.id = fi.media_item_id
        AND mi.library_id = fi.library_id
        AND mi.deleted_at IS NULL
       WHERE fi.library_id = ?
         AND fi.tag_id = ?`,
    )
    .get(libraryId, tagId) as
    | { face_count: number | bigint | null; media_item_count: number | bigint | null }
    | undefined;

  return {
    tagId: tag.id,
    label: tag.name,
    faceCount: Number(row?.face_count ?? 0),
    mediaItemCount: Number(row?.media_item_count ?? 0),
  };
}

export function deletePersonTag(
  tagId: string,
  libraryId = DEFAULT_LIBRARY_ID,
): boolean {
  const db = getDesktopDatabase();
  const existing = db
    .prepare(
      `SELECT id
       FROM media_tags
       WHERE id = ? AND library_id = ? AND tag_type = 'person'
       LIMIT 1`,
    )
    .get(tagId, libraryId) as { id: string } | undefined;
  if (!existing) {
    return false;
  }

  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE media_face_instances
       SET tag_id = NULL, updated_at = ?
       WHERE library_id = ? AND tag_id = ?`,
    ).run(now, libraryId, tagId);
    db.prepare(`DELETE FROM media_item_person_suggestions WHERE library_id = ? AND tag_id = ?`).run(
      libraryId,
      tagId,
    );
    db.prepare(`DELETE FROM person_centroids WHERE library_id = ? AND tag_id = ?`).run(
      libraryId,
      tagId,
    );
    db.prepare(`DELETE FROM person_tag_groups WHERE library_id = ? AND tag_id = ?`).run(
      libraryId,
      tagId,
    );
    db.prepare(`DELETE FROM media_album_person_tags WHERE library_id = ? AND tag_id = ?`).run(
      libraryId,
      tagId,
    );
    db.prepare(`DELETE FROM media_tags WHERE library_id = ? AND id = ? AND tag_type = 'person'`).run(
      libraryId,
      tagId,
    );
  });
  tx();
  return true;
}

export interface PersonTagWithFaceCount {
  id: string;
  label: string;
  pinned: boolean;
  birthDate: string | null;
  taggedFaceCount: number;
  /**
   * Cached `person_centroids.similar_untagged_face_count` (written by `refreshSuggestionsForTag`
   * via `findMatchesForPerson` at refresh time). The People tab UI uses live IPC counts instead;
   * this field remains for API consumers and fallback if live fetch fails.
   */
  similarFaceCount: number;
}

/**
 * Lists person tags with tagged-face counts and **cached** similar-untagged counts from
 * `person_centroids` (updated when `refreshSuggestionsForTag` runs — see face-tags-handlers,
 * assign flows, assignClusterToPerson, etc.).
 */
export function listPersonTagsWithFaceCounts(
  libraryId = DEFAULT_LIBRARY_ID,
): PersonTagWithFaceCount[] {
  const db = getDesktopDatabase();
  const rows = db
    .prepare(
      `SELECT
         mt.id,
         mt.name,
         COALESCE(mt.pinned, 0) AS pinned,
         mt.birth_date,
         (
           SELECT COUNT(*)
           FROM media_face_instances fi
           INNER JOIN media_items mi
             ON mi.id = fi.media_item_id
            AND mi.library_id = fi.library_id
            AND mi.deleted_at IS NULL
           WHERE fi.library_id = mt.library_id
             AND fi.tag_id = mt.id
         ) AS tagged_face_count,
         COALESCE(pc.similar_untagged_face_count, 0) AS similar_face_count
       FROM media_tags mt
       LEFT JOIN person_centroids pc
         ON pc.tag_id = mt.id AND pc.library_id = mt.library_id
       WHERE mt.library_id = ?
         AND mt.tag_type = 'person'
       ORDER BY COALESCE(mt.pinned, 0) DESC, mt.name COLLATE NOCASE ASC`,
    )
    .all(libraryId) as Array<{
    id: string;
    name: string;
    pinned: number;
    birth_date: string | null;
    tagged_face_count: number;
    similar_face_count: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    label: row.name,
    pinned: row.pinned === 1,
    birthDate: row.birth_date ?? null,
    taggedFaceCount: row.tagged_face_count,
    similarFaceCount: row.similar_face_count,
  }));
}

export function listFaceInstancesByMediaItem(
  mediaItemId: string,
  libraryId = DEFAULT_LIBRARY_ID,
): DesktopFaceInstance[] {
  const db = getDesktopDatabase();
  const rows = db
    .prepare(
      `SELECT
         fi.id,
         fi.media_item_id,
         fi.confidence,
         fi.tag_id,
         fi.bbox_x,
         fi.bbox_y,
         fi.bbox_width,
         fi.bbox_height,
         fi.landmarks_json,
         fi.embedding_status,
         fi.cluster_id,
         fi.crop_path,
         fi.estimated_age_years,
         fi.estimated_gender,
         fi.age_gender_confidence,
         fi.age_gender_model,
         ${FACE_BBOX_REF_WIDTH_SQL} AS ref_image_width,
         ${FACE_BBOX_REF_HEIGHT_SQL} AS ref_image_height,
         t.id AS tag_id_ref,
         t.name AS tag_name,
         COALESCE(t.pinned, 0) AS tag_pinned,
         t.birth_date AS tag_birth_date
       FROM media_face_instances fi
       INNER JOIN media_items mi ON mi.id = fi.media_item_id
       LEFT JOIN media_tags t ON t.id = fi.tag_id
       WHERE fi.library_id = ?
         AND fi.media_item_id = ?
         AND mi.deleted_at IS NULL
       ORDER BY fi.rowid ASC`,
    )
    .all(libraryId, mediaItemId) as Array<{
    id: string;
    media_item_id: string;
    confidence: number | null;
    tag_id: string | null;
    bbox_x: number | null;
    bbox_y: number | null;
    bbox_width: number | null;
    bbox_height: number | null;
    landmarks_json: string | null;
    embedding_status: string | null;
    cluster_id: string | null;
    crop_path: string | null;
    estimated_age_years: number | null;
    estimated_gender: string | null;
    age_gender_confidence: number | null;
    age_gender_model: string | null;
    ref_image_width: number | null;
    ref_image_height: number | null;
    tag_id_ref: string | null;
    tag_name: string | null;
    tag_pinned: number | null;
    tag_birth_date: string | null;
  }>;

  return rows.map((row, index) => ({
    id: row.id,
    media_item_id: row.media_item_id,
    face_index: index,
    type: "auto",
    confidence: row.confidence,
    tag_id: row.tag_id,
    tag:
      row.tag_id_ref && row.tag_name
        ? {
            id: row.tag_id_ref,
            label: row.tag_name,
            pinned: row.tag_pinned === 1,
            birthDate: row.tag_birth_date ?? null,
          }
        : null,
    bounding_box: {
      x: row.bbox_x,
      y: row.bbox_y,
      width: row.bbox_width,
      height: row.bbox_height,
    },
    ref_image_width: row.ref_image_width,
    ref_image_height: row.ref_image_height,
    landmarks_5: parseLandmarks(row.landmarks_json),
    embedding_status: row.embedding_status,
    cluster_id: row.cluster_id,
    crop_path: row.crop_path,
    estimated_age_years: row.estimated_age_years,
    estimated_gender: row.estimated_gender,
    age_gender_confidence: row.age_gender_confidence,
    age_gender_model: row.age_gender_model,
  }));
}

export function assignPersonTagToFaceInstance(
  faceInstanceId: string,
  tagId: string,
  libraryId = DEFAULT_LIBRARY_ID,
): DesktopFaceInstance | null {
  const db = getDesktopDatabase();
  const now = new Date().toISOString();

  const result = db
    .prepare(
      `UPDATE media_face_instances
       SET tag_id = ?, cluster_id = NULL, updated_at = ?
       WHERE id = ? AND library_id = ?`,
    )
    .run(tagId, now, faceInstanceId, libraryId);

  if (result.changes === 0) {
    return null;
  }

  return getFaceInstanceById(faceInstanceId, libraryId);
}

export function countTaggedFacesForPerson(
  tagId: string,
  libraryId = DEFAULT_LIBRARY_ID,
): number {
  const db = getDesktopDatabase();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c
       FROM media_face_instances fi
       INNER JOIN media_items mi ON mi.id = fi.media_item_id AND mi.library_id = fi.library_id
       WHERE fi.library_id = ?
         AND fi.tag_id = ?
         AND mi.deleted_at IS NULL`,
    )
    .get(libraryId, tagId) as { c: number } | undefined;
  return row?.c ?? 0;
}

/**
 * Assign the same person tag to many face instances in one transaction.
 * Returns how many rows were updated and deduped media_item_ids for suggestion cleanup.
 */
export function assignPersonTagsToFaceInstances(
  faceInstanceIds: string[],
  tagId: string,
  libraryId = DEFAULT_LIBRARY_ID,
): { assignedCount: number; affectedMediaItemIds: string[] } {
  const unique = Array.from(new Set(faceInstanceIds.filter((id) => id.length > 0)));
  if (unique.length === 0) {
    return { assignedCount: 0, affectedMediaItemIds: [] };
  }

  const db = getDesktopDatabase();
  const now = new Date().toISOString();
  const mediaSet = new Set<string>();
  let assignedCount = 0;

  const run = db.transaction(() => {
    const selectMi = db.prepare(
      `SELECT media_item_id FROM media_face_instances WHERE id = ? AND library_id = ?`,
    );
    const upd = db.prepare(
      `UPDATE media_face_instances
       SET tag_id = ?, cluster_id = NULL, updated_at = ?
       WHERE id = ? AND library_id = ?`,
    );
    for (const id of unique) {
      const row = selectMi.get(id, libraryId) as { media_item_id: string } | undefined;
      if (!row) {
        continue;
      }
      const result = upd.run(tagId, now, id, libraryId);
      if (result.changes > 0) {
        assignedCount += 1;
        mediaSet.add(row.media_item_id);
      }
    }
  });
  run();

  return { assignedCount, affectedMediaItemIds: Array.from(mediaSet) };
}

export function clearPersonTagFromFaceInstance(
  faceInstanceId: string,
  libraryId = DEFAULT_LIBRARY_ID,
): DesktopFaceInstance | null {
  const db = getDesktopDatabase();
  const now = new Date().toISOString();

  const result = db
    .prepare(
      `UPDATE media_face_instances
       SET tag_id = NULL, updated_at = ?
       WHERE id = ? AND library_id = ?`,
    )
    .run(now, faceInstanceId, libraryId);

  if (result.changes === 0) {
    return null;
  }

  return getFaceInstanceById(faceInstanceId, libraryId);
}

export function deleteFaceInstance(faceInstanceId: string, libraryId = DEFAULT_LIBRARY_ID): boolean {
  const db = getDesktopDatabase();
  const now = new Date().toISOString();
  const faceRow = db
    .prepare(
      `SELECT id, media_item_id
       FROM media_face_instances
       WHERE id = ? AND library_id = ?
       LIMIT 1`,
    )
    .get(faceInstanceId, libraryId) as { id: string; media_item_id: string } | undefined;

  if (!faceRow) {
    return false;
  }

  const orderedIds = db
    .prepare(
      `SELECT id
       FROM media_face_instances
       WHERE library_id = ? AND media_item_id = ?
       ORDER BY rowid ASC`,
    )
    .all(libraryId, faceRow.media_item_id) as Array<{ id: string }>;
  const deletedIndex = orderedIds.findIndex((row) => row.id === faceRow.id);

  const deleted = db
    .prepare(
      `DELETE FROM media_face_instances
       WHERE id = ? AND library_id = ?`,
    )
    .run(faceInstanceId, libraryId);
  if (deleted.changes === 0) {
    return false;
  }

  const metadataRow = db
    .prepare(
      `SELECT ai_metadata
       FROM media_items
       WHERE id = ? AND library_id = ?
       LIMIT 1`,
    )
    .get(faceRow.media_item_id, libraryId) as { ai_metadata: string | null } | undefined;

  if (!metadataRow) {
    return true;
  }

  const current = parseJson(metadataRow.ai_metadata);
  const boxes = getPeopleBoundingBoxes(current);
  if (deletedIndex < 0 || deletedIndex >= boxes.length) {
    return true;
  }

  const nextBoxes = boxes.filter((_, index) => index !== deletedIndex);
  const nextMetadata = mergeMetadataV2(current, {
    people: {
      number_of_people: nextBoxes.length > 0 ? nextBoxes.length : null,
      detections: {
        people_bounding_boxes: nextBoxes.length > 0 ? nextBoxes : null,
      },
    },
  } as Partial<MediaMetadata>);

  db.prepare(`UPDATE media_items SET ai_metadata = ?, updated_at = ? WHERE id = ?`).run(
    JSON.stringify(nextMetadata),
    now,
    faceRow.media_item_id,
  );

  return true;
}

function getFaceInstanceById(
  faceInstanceId: string,
  libraryId = DEFAULT_LIBRARY_ID,
): DesktopFaceInstance | null {
  const db = getDesktopDatabase();
  const row = db
    .prepare(
      `SELECT media_item_id
       FROM media_face_instances
       WHERE id = ? AND library_id = ?
       LIMIT 1`,
    )
    .get(faceInstanceId, libraryId) as { media_item_id: string } | undefined;
  if (!row) {
    return null;
  }

  const items = listFaceInstancesByMediaItem(row.media_item_id, libraryId);
  return items.find((item) => item.id === faceInstanceId) ?? null;
}

export interface TaggedFaceInfo {
  faceInstanceId: string;
  mediaItemId: string;
  sourcePath: string;
  confidence: number | null;
  bboxX: number;
  bboxY: number;
  bboxWidth: number;
  bboxHeight: number;
  imageWidth: number | null;
  imageHeight: number | null;
}

export function listFacesTaggedForPerson(
  tagId: string,
  libraryId = DEFAULT_LIBRARY_ID,
): TaggedFaceInfo[] {
  const db = getDesktopDatabase();
  const rows = db
    .prepare(
      `SELECT
         fi.id AS face_instance_id,
         fi.media_item_id,
         mi.source_path,
         fi.confidence,
         fi.bbox_x, fi.bbox_y, fi.bbox_width, fi.bbox_height,
         ${FACE_BBOX_REF_WIDTH_SQL} AS image_width,
         ${FACE_BBOX_REF_HEIGHT_SQL} AS image_height
       FROM media_face_instances fi
       INNER JOIN media_items mi ON mi.id = fi.media_item_id
       WHERE fi.library_id = ?
         AND mi.deleted_at IS NULL
         AND fi.tag_id = ?
       ORDER BY fi.confidence DESC`,
    )
    .all(libraryId, tagId) as Array<{
    face_instance_id: string;
    media_item_id: string;
    source_path: string;
    confidence: number | null;
    bbox_x: number;
    bbox_y: number;
    bbox_width: number;
    bbox_height: number;
    image_width: number | null;
    image_height: number | null;
  }>;

  return rows.map((row) => ({
    faceInstanceId: row.face_instance_id,
    mediaItemId: row.media_item_id,
    sourcePath: row.source_path,
    confidence: row.confidence,
    bboxX: row.bbox_x,
    bboxY: row.bbox_y,
    bboxWidth: row.bbox_width,
    bboxHeight: row.bbox_height,
    imageWidth: row.image_width,
    imageHeight: row.image_height,
  }));
}

export interface FaceInfoForCrop {
  faceInstanceId: string;
  sourcePath: string;
  bboxX: number;
  bboxY: number;
  bboxWidth: number;
  bboxHeight: number;
  imageWidth: number | null;
  imageHeight: number | null;
}

export function getFaceInfoByIds(
  faceInstanceIds: string[],
  libraryId = DEFAULT_LIBRARY_ID,
): Record<string, FaceInfoForCrop | null> {
  if (faceInstanceIds.length === 0) return {};
  const db = getDesktopDatabase();
  const placeholders = faceInstanceIds.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT fi.id, mi.source_path, fi.bbox_x, fi.bbox_y, fi.bbox_width, fi.bbox_height,
              ${FACE_BBOX_REF_WIDTH_SQL} AS image_width, ${FACE_BBOX_REF_HEIGHT_SQL} AS image_height
       FROM media_face_instances fi
       INNER JOIN media_items mi ON mi.id = fi.media_item_id
       WHERE fi.library_id = ? AND mi.deleted_at IS NULL AND fi.id IN (${placeholders})`,
    )
    .all(libraryId, ...faceInstanceIds) as Array<{
    id: string;
    source_path: string;
    bbox_x: number;
    bbox_y: number;
    bbox_width: number;
    bbox_height: number;
    image_width: number | null;
    image_height: number | null;
  }>;

  const result: Record<string, FaceInfoForCrop | null> = {};
  for (const id of faceInstanceIds) {
    result[id] = null;
  }
  for (const row of rows) {
    result[row.id] = {
      faceInstanceId: row.id,
      sourcePath: row.source_path,
      bboxX: row.bbox_x,
      bboxY: row.bbox_y,
      bboxWidth: row.bbox_width,
      bboxHeight: row.bbox_height,
      imageWidth: row.image_width,
      imageHeight: row.image_height,
    };
  }
  return result;
}

export function getFaceCropPathsByIds(
  faceInstanceIds: string[],
  libraryId = DEFAULT_LIBRARY_ID,
): Record<string, string | null> {
  if (faceInstanceIds.length === 0) return {};
  const db = getDesktopDatabase();
  const placeholders = faceInstanceIds.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT id, crop_path FROM media_face_instances
       WHERE library_id = ? AND id IN (${placeholders})`,
    )
    .all(libraryId, ...faceInstanceIds) as Array<{ id: string; crop_path: string | null }>;

  const result: Record<string, string | null> = {};
  for (const id of faceInstanceIds) {
    result[id] = null;
  }
  for (const row of rows) {
    result[row.id] = row.crop_path;
  }
  return result;
}

function parseLandmarks(value: string | null | undefined): Array<[number, number]> | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 5 ||
      !parsed.every(
        (pt: unknown) =>
          Array.isArray(pt) &&
          pt.length === 2 &&
          typeof pt[0] === "number" &&
          typeof pt[1] === "number",
      )
    ) {
      return null;
    }
    return parsed as Array<[number, number]>;
  } catch {
    return null;
  }
}

function parseJson(value: string | null | undefined): unknown {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

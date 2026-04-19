import { randomUUID } from "node:crypto";
import path from "node:path";
import type { FaceDetectionOutput, PhotoAnalysisOutput } from "../../src/shared/ipc";
import {
  mergeMetadataV2,
  type BeingBoundingBox,
  type FaceOrientationMetadata,
  type MediaImageCategory,
  type PersonInfo,
} from "@emk/media-metadata-core";
import { estimateRotationFromFaceLandmarks } from "@emk/shared-contracts";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";
import { getFtsFieldsFromAiMetadata, starRatingToFtsTokens, upsertFtsEntry } from "./keyword-search";

/** Keep IN-list size well under SQLite's default 999-variable limit (leaving room for fixed params). */
const IN_CHUNK_SIZE = 900;

export function getAlreadyAnalyzedPhotoPaths(
  _folderPath: string,
  photoPaths: string[],
  libraryId = DEFAULT_LIBRARY_ID,
): Set<string> {
  if (photoPaths.length === 0) {
    return new Set<string>();
  }

  const db = getDesktopDatabase();
  const analyzed = new Set<string>();
  const sqlPrefix = `SELECT source_path, ai_metadata FROM media_items WHERE library_id = ? AND photo_analysis_processed_at IS NOT NULL AND source_path IN (`;
  const sqlSuffix = `)`;

  for (let i = 0; i < photoPaths.length; i += IN_CHUNK_SIZE) {
    const chunk = photoPaths.slice(i, i + IN_CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = db
      .prepare(sqlPrefix + placeholders + sqlSuffix)
      .all(libraryId, ...chunk) as Array<{ source_path: string; ai_metadata: string | null }>;
    for (const row of rows) {
      if (hasPhotoAnalysisSignature(row.ai_metadata)) {
        analyzed.add(row.source_path);
      }
    }
  }
  return analyzed;
}

export function getAlreadyFaceDetectedPhotoPaths(
  _folderPath: string,
  photoPaths: string[],
  libraryId = DEFAULT_LIBRARY_ID,
): Set<string> {
  if (photoPaths.length === 0) {
    return new Set<string>();
  }

  const db = getDesktopDatabase();
  const result = new Set<string>();
  const sqlPrefix = `SELECT source_path FROM media_items WHERE library_id = ? AND face_detection_processed_at IS NOT NULL AND source_path IN (`;
  const sqlSuffix = `)`;

  for (let i = 0; i < photoPaths.length; i += IN_CHUNK_SIZE) {
    const chunk = photoPaths.slice(i, i + IN_CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = db
      .prepare(sqlPrefix + placeholders + sqlSuffix)
      .all(libraryId, ...chunk) as Array<{ source_path: string }>;
    for (const row of rows) {
      result.add(row.source_path);
    }
  }
  return result;
}

export function getPhotoAnalysisFailedPaths(
  photoPaths: string[],
  libraryId = DEFAULT_LIBRARY_ID,
): Set<string> {
  if (photoPaths.length === 0) {
    return new Set<string>();
  }
  const db = getDesktopDatabase();
  const failed = new Set<string>();
  const sqlPrefix = `SELECT source_path
    FROM media_items
    WHERE library_id = ?
      AND photo_analysis_failed_at IS NOT NULL
      AND source_path IN (`;
  const sqlSuffix = `)`;
  for (let i = 0; i < photoPaths.length; i += IN_CHUNK_SIZE) {
    const chunk = photoPaths.slice(i, i + IN_CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = db
      .prepare(sqlPrefix + placeholders + sqlSuffix)
      .all(libraryId, ...chunk) as Array<{ source_path: string }>;
    for (const row of rows) {
      failed.add(row.source_path);
    }
  }
  return failed;
}

export function getFaceDetectionFailedPaths(
  photoPaths: string[],
  libraryId = DEFAULT_LIBRARY_ID,
): Set<string> {
  if (photoPaths.length === 0) {
    return new Set<string>();
  }
  const db = getDesktopDatabase();
  const failed = new Set<string>();
  const sqlPrefix = `SELECT source_path
    FROM media_items
    WHERE library_id = ?
      AND face_detection_failed_at IS NOT NULL
      AND source_path IN (`;
  const sqlSuffix = `)`;
  for (let i = 0; i < photoPaths.length; i += IN_CHUNK_SIZE) {
    const chunk = photoPaths.slice(i, i + IN_CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = db
      .prepare(sqlPrefix + placeholders + sqlSuffix)
      .all(libraryId, ...chunk) as Array<{ source_path: string }>;
    for (const row of rows) {
      failed.add(row.source_path);
    }
  }
  return failed;
}

export function upsertPhotoAnalysisResult(
  photoPath: string,
  result: PhotoAnalysisOutput,
  libraryId = DEFAULT_LIBRARY_ID,
): string | null {
  const db = getDesktopDatabase();
  const now = new Date().toISOString();
  const filename = path.basename(photoPath);
  const location = result.location?.trim() ?? null;
  const { city, country } = splitLocation(result.location);
  const peopleDetected =
    typeof result.number_of_people === "number" ? Math.max(0, Math.floor(result.number_of_people)) : null;
  const { ageMin, ageMax } = inferAgeRange(result);
  const normalizedPeople: PersonInfo[] | null =
    Array.isArray(result.people) && result.people.length > 0
      ? result.people.map((person) => ({
          person_category: person.person_category ?? null,
          gender: person.gender ?? null,
          average_age: person.average_age ?? null,
        }))
      : null;
  const existingAiMetadata = db
    .prepare(`SELECT ai_metadata FROM media_items WHERE library_id = ? AND source_path = ? LIMIT 1`)
    .get(libraryId, photoPath) as { ai_metadata: string | null } | undefined;
  const aiMetadata = JSON.stringify(
    (() => {
      const merged = mergeMetadataV2(parseJson(existingAiMetadata?.ai_metadata), {
      schema_version: "2.0",
      people: {
        number_of_people: peopleDetected,
        has_children: result.has_children ?? null,
        people_detected: normalizedPeople,
      },
      ai: {
        image_category: (result.image_category as MediaImageCategory) ?? null,
        title: result.title ?? null,
        description: result.description ?? null,
        location: result.location
          ? {
              country: result.location,
              source: "ai",
            }
          : null,
        date: result.date ?? null,
        time: result.time ?? null,
        weather: result.weather ?? null,
        photo_estetic_quality: result.photo_estetic_quality ?? null,
        photo_analysis_method: result.modelInfo?.model ?? null,
      },
      provenance: {
        metadata_version: "2.0",
        metadata_extracted_at: now,
        sources: {
          analysis: "desktop-vision",
        },
      },
    });

      const knownFields = new Set([
        "image_category",
        "title",
        "description",
        "number_of_people",
        "has_children",
        "has_child_or_children",
        "people",
        "location",
        "date",
        "time",
        "weather",
        "daytime",
        "photo_estetic_quality",
        "modelInfo",
      ]);

      for (const [key, value] of Object.entries(result)) {
        if (!knownFields.has(key) && value !== undefined && value !== null) {
          merged[key] = value;
        }
      }

      return merged;
    })(),
  );

  db.prepare(
    `INSERT INTO media_items (
      id,
      library_id,
      source_path,
      filename,
      location_name,
      city,
      country,
      people_detected,
      age_min,
      age_max,
      ai_metadata,
      photo_analysis_processed_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(library_id, source_path) DO UPDATE SET
      filename = excluded.filename,
      location_name = excluded.location_name,
      city = excluded.city,
      country = excluded.country,
      people_detected = excluded.people_detected,
      age_min = excluded.age_min,
      age_max = excluded.age_max,
      ai_metadata = excluded.ai_metadata,
      photo_analysis_processed_at = excluded.photo_analysis_processed_at,
      photo_analysis_failed_at = NULL,
      photo_analysis_error = NULL,
      updated_at = excluded.updated_at`,
  ).run(
    randomUUID(),
    libraryId,
    photoPath,
    filename,
    location,
    city,
    country,
    peopleDetected,
    ageMin,
    ageMax,
    aiMetadata,
    now,
    now,
    now,
  );

  const mediaItem = db
    .prepare(
      `SELECT id, star_rating FROM media_items WHERE library_id = ? AND source_path = ? LIMIT 1`,
    )
    .get(libraryId, photoPath) as { id: string; star_rating: number | null } | undefined;

  if (mediaItem) {
    try {
      const fts = getFtsFieldsFromAiMetadata(JSON.parse(aiMetadata), location);
      const ratingTokens =
        typeof mediaItem.star_rating === "number" && Number.isFinite(mediaItem.star_rating)
          ? starRatingToFtsTokens(mediaItem.star_rating)
          : fts.ratingTokens;
      upsertFtsEntry(
        mediaItem.id,
        fts.title || null,
        fts.description || null,
        fts.location || null,
        fts.category || null,
        ratingTokens,
        libraryId,
      );
    } catch {
      // FTS5 index update is best-effort; search degrades gracefully
    }
  }

  return mediaItem?.id ?? null;
}

export function buildCaptionText(result: PhotoAnalysisOutput): string {
  const chunks: string[] = [];
  if (result.title) chunks.push(result.title);
  if (result.description) chunks.push(result.description);
  if (result.location) chunks.push(`Location: ${result.location}`);
  if (typeof result.number_of_people === "number") {
    chunks.push(`People detected: ${result.number_of_people}`);
  }
  if (Array.isArray(result.people) && result.people.length > 0) {
    const ages = result.people
      .map((person) => person.average_age)
      .filter((value): value is number => typeof value === "number");
    if (ages.length > 0) {
      chunks.push(`Detected ages: ${ages.map((age) => String(age)).join(", ")}`);
    }
  }
  return chunks.join(". ");
}

function splitLocation(location: string | null | undefined): { city: string | null; country: string | null } {
  if (!location) {
    return { city: null, country: null };
  }
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return { city: null, country: null };
  }
  if (parts.length === 1) {
    return { city: parts[0], country: null };
  }
  return { city: parts[0], country: parts[parts.length - 1] };
}

function inferAgeRange(result: PhotoAnalysisOutput): { ageMin: number | null; ageMax: number | null } {
  const ages = (result.people ?? [])
    .map((person) => person.average_age)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (ages.length === 0) {
    return { ageMin: null, ageMax: null };
  }

  return {
    ageMin: Math.min(...ages),
    ageMax: Math.max(...ages),
  };
}

export function upsertFaceDetectionResult(
  photoPath: string,
  result: FaceDetectionOutput,
  libraryId = DEFAULT_LIBRARY_ID,
): string | null {
  const db = getDesktopDatabase();
  const now = new Date().toISOString();
  const filename = path.basename(photoPath);

  db.prepare(
    `INSERT INTO media_items (
      id,
      library_id,
      source_path,
      filename,
      face_detection_processed_at,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(library_id, source_path) DO UPDATE SET
      filename = excluded.filename,
      face_detection_processed_at = excluded.face_detection_processed_at,
      face_detection_failed_at = NULL,
      face_detection_error = NULL,
      deleted_at = NULL,
      updated_at = excluded.updated_at`,
  ).run(randomUUID(), libraryId, photoPath, filename, now, now, now);

  const mediaItem = db
    .prepare(
      `SELECT id FROM media_items WHERE library_id = ? AND source_path = ? LIMIT 1`,
    )
    .get(libraryId, photoPath) as { id: string } | undefined;

  if (!mediaItem) {
    return null;
  }

  const existingAiMetadata = db
    .prepare(`SELECT ai_metadata FROM media_items WHERE id = ? LIMIT 1`)
    .get(mediaItem.id) as { ai_metadata: string | null } | undefined;

  const faceOrientation = computeFaceOrientation(result);

  const merged = mergeMetadataV2(parseJson(existingAiMetadata?.ai_metadata), {
    schema_version: "2.0",
    people: {
      number_of_people: result.faceCount > 0 ? result.faceCount : null,
      detections: {
        face_detection_method: "retinaface",
        image_size_for_bounding_boxes: result.imageSizeForBoundingBoxes,
        people_bounding_boxes:
          result.peopleBoundingBoxes.length > 0
            ? normalizeFaceBeingBoxes(result.peopleBoundingBoxes)
            : null,
        face_orientation: faceOrientation,
      },
    },
    provenance: {
      metadata_version: "2.0",
      metadata_extracted_at: now,
      sources: {
        face_detection: result.modelInfo.modelName,
      },
    },
  });

  if (faceOrientation && faceOrientation.correction_angle_clockwise !== 0) {
    merged.edit_suggestions = [
      {
        edit_type: "rotate",
        priority: "high",
        reason: "Face-landmark orientation detected during face detection.",
        confidence: null,
        auto_apply_safe: true,
        rotation: { angle_degrees_clockwise: faceOrientation.correction_angle_clockwise },
      },
    ];
  }

  const nextAiMetadata = JSON.stringify(merged);

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE media_items
       SET ai_metadata = ?, face_detection_processed_at = ?,
           face_detection_failed_at = NULL, face_detection_error = NULL,
           deleted_at = NULL, updated_at = ?
       WHERE id = ?`,
    ).run(
      nextAiMetadata,
      now,
      now,
      mediaItem.id,
    );

    db.prepare(
      `DELETE FROM media_face_instances
       WHERE library_id = ? AND media_item_id = ? AND source = 'auto'`,
    ).run(libraryId, mediaItem.id);

    const insertFace = db.prepare(
      `INSERT INTO media_face_instances (
        id,
        library_id,
        media_item_id,
        source,
        confidence,
        bbox_x,
        bbox_y,
        bbox_width,
        bbox_height,
        bbox_ref_width,
        bbox_ref_height,
        landmarks_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, 'auto', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const refW = result.imageSizeForBoundingBoxes?.width ?? null;
    const refH = result.imageSizeForBoundingBoxes?.height ?? null;

    for (const face of result.faces) {
      const [left, top, right, bottom] = face.bbox_xyxy;
      const landmarksJson =
        Array.isArray(face.landmarks_5) && face.landmarks_5.length === 5
          ? JSON.stringify(face.landmarks_5)
          : null;
      insertFace.run(
        randomUUID(),
        libraryId,
        mediaItem.id,
        face.score,
        left,
        top,
        Math.max(0, right - left),
        Math.max(0, bottom - top),
        refW,
        refH,
        landmarksJson,
        now,
        now,
      );
    }
  });

  tx();
  return mediaItem.id;
}

const ROTATION_PIPELINE_SOURCE = "auto-rotation-pipeline";

/**
 * Save faces discovered during the AI rotation pipeline to the DB.
 *
 * These faces were detected on a rotated copy of the image and their
 * coordinates have already been transformed back to the original
 * (unrotated) pixel space.  They are stored with
 * `source = 'auto-rotation-pipeline'` so they can be distinguished
 * from regular face-detection results (`source = 'auto'`).
 *
 * Existing rotation-pipeline faces for the same media item are replaced
 * while regular `auto` detections are left untouched.
 */
export function upsertRotationPipelineFaces(
  photoPath: string,
  faces: FaceDetectionOutput,
  libraryId = DEFAULT_LIBRARY_ID,
): void {
  if (faces.faceCount === 0) {
    return;
  }

  const db = getDesktopDatabase();
  const now = new Date().toISOString();
  const filename = path.basename(photoPath);

  db.prepare(
    `INSERT INTO media_items (
      id, library_id, source_path, filename, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(library_id, source_path) DO UPDATE SET
      filename = excluded.filename,
      updated_at = excluded.updated_at`,
  ).run(randomUUID(), libraryId, photoPath, filename, now, now);

  const mediaItem = db
    .prepare(
      `SELECT id FROM media_items WHERE library_id = ? AND source_path = ? LIMIT 1`,
    )
    .get(libraryId, photoPath) as { id: string } | undefined;

  if (!mediaItem) {
    return;
  }

  const tx = db.transaction(() => {
    db.prepare(
      `DELETE FROM media_face_instances
       WHERE library_id = ? AND media_item_id = ? AND source = ?`,
    ).run(libraryId, mediaItem.id, ROTATION_PIPELINE_SOURCE);

    const hasAutoFaces = db
      .prepare(
        `SELECT 1 FROM media_face_instances
         WHERE library_id = ? AND media_item_id = ? AND source = 'auto' LIMIT 1`,
      )
      .get(libraryId, mediaItem.id);

    if (hasAutoFaces) {
      // Do not delete – may be needed for future debugging of face-rotation pipeline
      // console.log(
      //   `[media-analysis] Rotation-pipeline faces skipped for "${filename}": ` +
      //   `regular 'auto' faces already exist`,
      // );
      return;
    }

    const existingAiMetadata = db
      .prepare(`SELECT ai_metadata FROM media_items WHERE id = ? LIMIT 1`)
      .get(mediaItem.id) as { ai_metadata: string | null } | undefined;

    const rotFaceOrientation = computeFaceOrientation(faces);

    const rotMerged = mergeMetadataV2(parseJson(existingAiMetadata?.ai_metadata), {
      schema_version: "2.0",
      people: {
        number_of_people: faces.faceCount > 0 ? faces.faceCount : null,
        detections: {
          face_detection_method: "retinaface",
          image_size_for_bounding_boxes: faces.imageSizeForBoundingBoxes,
          people_bounding_boxes:
            faces.peopleBoundingBoxes.length > 0
              ? normalizeFaceBeingBoxes(faces.peopleBoundingBoxes)
              : null,
          face_orientation: rotFaceOrientation,
        },
      },
      provenance: {
        metadata_version: "2.0",
        metadata_extracted_at: now,
        sources: {
          face_detection: faces.modelInfo.modelName,
        },
      },
    });

    if (rotFaceOrientation && rotFaceOrientation.correction_angle_clockwise !== 0) {
      rotMerged.edit_suggestions = [
        {
          edit_type: "rotate",
          priority: "high",
          reason: "Face-landmark orientation detected during face detection.",
          confidence: null,
          auto_apply_safe: true,
          rotation: { angle_degrees_clockwise: rotFaceOrientation.correction_angle_clockwise },
        },
      ];
    }

    const nextAiMetadata = JSON.stringify(rotMerged);

    db.prepare(
      `UPDATE media_items
       SET ai_metadata = ?, face_detection_processed_at = ?, updated_at = ?
       WHERE id = ?`,
    ).run(nextAiMetadata, now, now, mediaItem.id);

    const insertFace = db.prepare(
      `INSERT INTO media_face_instances (
        id, library_id, media_item_id, source, confidence,
        bbox_x, bbox_y, bbox_width, bbox_height,
        bbox_ref_width, bbox_ref_height,
        landmarks_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const rotRefW = faces.imageSizeForBoundingBoxes?.width ?? null;
    const rotRefH = faces.imageSizeForBoundingBoxes?.height ?? null;

    for (const face of faces.faces) {
      const [left, top, right, bottom] = face.bbox_xyxy;
      const landmarksJson =
        Array.isArray(face.landmarks_5) && face.landmarks_5.length === 5
          ? JSON.stringify(face.landmarks_5)
          : null;
      insertFace.run(
        randomUUID(),
        libraryId,
        mediaItem.id,
        ROTATION_PIPELINE_SOURCE,
        face.score,
        left,
        top,
        Math.max(0, right - left),
        Math.max(0, bottom - top),
        rotRefW,
        rotRefH,
        landmarksJson,
        now,
        now,
      );
    }

    // Do not delete – may be needed for future debugging of face-rotation pipeline
    // console.log(
    //   `[media-analysis] Saved ${faces.faceCount} rotation-pipeline face(s) for "${filename}"`,
    // );
  });

  tx();
}

function normalizeFaceBeingBoxes(boxes: FaceDetectionOutput["peopleBoundingBoxes"]): BeingBoundingBox[] {
  return boxes.map((box) => ({
    person_category: box.person_category ?? null,
    gender: box.gender ?? null,
    person_bounding_box: box.person_bounding_box ?? undefined,
    person_face_bounding_box: box.person_face_bounding_box ?? null,
    provider_raw_bounding_box: box.provider_raw_bounding_box ?? null,
    azureFaceAttributes: box.azureFaceAttributes ?? null,
    detected_features: box.detected_features ?? null,
  }));
}

function computeFaceOrientation(result: FaceDetectionOutput): FaceOrientationMetadata | null {
  if (result.faceCount === 0) {
    return null;
  }
  const facesWithLandmarks = result.faces
    .filter((f) => Array.isArray(f.landmarks_5) && f.landmarks_5.length >= 5)
    .map((f) => ({ landmarks: f.landmarks_5, score: f.score }));

  if (facesWithLandmarks.length === 0) {
    return null;
  }

  const rotation = estimateRotationFromFaceLandmarks(facesWithLandmarks);
  if (!rotation) {
    return null;
  }

  return {
    orientation: rotation.orientation,
    correction_angle_clockwise: rotation.correctionAngleClockwise,
    confidence: rotation.confidence,
    face_count: rotation.faceCount,
  };
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

function hasPhotoAnalysisSignature(aiMetadataRaw: string | null): boolean {
  if (!aiMetadataRaw) {
    return false;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(aiMetadataRaw);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object") {
    return false;
  }

  const root = parsed as Record<string, unknown>;
  const aiNode =
    root.ai && typeof root.ai === "object" ? (root.ai as Record<string, unknown>) : root;

  const imageCategory = aiNode.image_category;
  const title = aiNode.title;
  const description = aiNode.description;

  return (
    typeof imageCategory === "string" &&
    imageCategory.trim().length > 0 &&
    typeof title === "string" &&
    title.trim().length > 0 &&
    typeof description === "string" &&
    description.trim().length > 0
  );
}

const MAX_ERROR_LENGTH = 500;

export function markFaceDetectionFailed(
  photoPath: string,
  errorMessage: string,
  libraryId = DEFAULT_LIBRARY_ID,
): void {
  const db = getDesktopDatabase();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE media_items
     SET face_detection_failed_at = ?,
         face_detection_error = ?,
         updated_at = ?
     WHERE library_id = ? AND source_path = ?`,
  ).run(now, errorMessage.slice(0, MAX_ERROR_LENGTH), now, libraryId, photoPath);
}

export function markPhotoAnalysisFailed(
  photoPath: string,
  errorMessage: string,
  libraryId = DEFAULT_LIBRARY_ID,
): void {
  const db = getDesktopDatabase();
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE media_items
     SET photo_analysis_failed_at = ?,
         photo_analysis_error = ?,
         updated_at = ?
     WHERE library_id = ? AND source_path = ?`,
  ).run(now, errorMessage.slice(0, MAX_ERROR_LENGTH), now, libraryId, photoPath);
}

import { randomUUID } from "node:crypto";
import path from "node:path";
import type {
  FaceDetectionOutput,
  FaceDetectionSettings,
  FaceDetectorModelId,
  PhotoAnalysisOutput,
} from "../../src/shared/ipc";
import { DEFAULT_FACE_DETECTION_SETTINGS } from "../../src/shared/ipc";
import {
  mergeMetadataV2,
  type BeingBoundingBox,
  type FaceDetectionMethod,
  type FaceOrientationMetadata,
  type MediaImageCategory,
  type PersonInfo,
} from "@emk/media-metadata-core";
import {
  greedyMatchBoxesByIou,
  rescaleBoxToImageSize,
  type PixelXyxyBox,
} from "@emk/shared-contracts";
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
        vlm_analysis: {
          number_of_people: peopleDetected,
          has_children: result.has_children ?? null,
          people_detected: normalizedPeople,
        },
      },
      image_analysis: {
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
        photo_star_rating_1_5: result.photo_star_rating_1_5 ?? null,
        is_low_quality: result.is_low_quality ?? null,
        quality_issues: result.quality_issues ?? null,
      },
      metadata_version: "desktop-photo-metadata-v2",
      file_data: {
        metadata_extracted_at: now,
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

      delete merged.rotation_decision;
      delete merged.two_pass_rotation_consistency;
      delete merged.face_rotation_override;
      sanitizeLegacyPeopleShape(merged);

      merged.edit_suggestions = stripRotateEditSuggestions(merged.edit_suggestions);

      return merged;
    })(),
  );

  const existingFaceCount = getFaceCountFromMetadata(parseJson(existingAiMetadata?.ai_metadata));
  const peopleDetectedForSearch = existingFaceCount ?? peopleDetected;

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
    peopleDetectedForSearch,
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

interface ExistingFaceRow {
  id: string;
  tag_id: string | null;
  cluster_id: string | null;
  bbox_x: number | null;
  bbox_y: number | null;
  bbox_width: number | null;
  bbox_height: number | null;
  bbox_ref_width: number | null;
  bbox_ref_height: number | null;
}

export interface ImageOrientationClassifierResult {
  correctionAngleClockwise: 0 | 90 | 180 | 270;
  confidence: number;
  model: string;
}

export interface OrientationDetectionState {
  source: "image-orientation-classifier" | "face_landmarks";
  correctionAngleClockwise: 0 | 90 | 180 | 270;
  confidence: number | null;
  processedAt: string;
}

export function getOrientationDetectionStateByPath(
  photoPath: string,
  libraryId = DEFAULT_LIBRARY_ID,
): OrientationDetectionState | null {
  const db = getDesktopDatabase();
  const row = db
    .prepare(
      `SELECT ai_metadata FROM media_items WHERE library_id = ? AND source_path = ? LIMIT 1`,
    )
    .get(libraryId, photoPath) as { ai_metadata: string | null } | undefined;
  const parsed = parseJson(row?.ai_metadata) as Record<string, unknown> | null;
  if (!parsed || typeof parsed !== "object") return null;
  const node = parsed.orientation_detection;
  if (!node || typeof node !== "object") return null;
  const rec = node as Record<string, unknown>;
  const source = rec.source;
  const angle = rec.correction_angle_clockwise;
  const confidence = rec.confidence;
  const processedAt = rec.processed_at;
  if (
    (source !== "image-orientation-classifier" && source !== "face_landmarks") ||
    (angle !== 0 && angle !== 90 && angle !== 180 && angle !== 270) ||
    typeof processedAt !== "string" ||
    processedAt.trim().length === 0
  ) {
    return null;
  }
  return {
    source,
    correctionAngleClockwise: angle,
    confidence: typeof confidence === "number" ? confidence : null,
    processedAt,
  };
}

export function upsertFaceDetectionResult(
  photoPath: string,
  result: FaceDetectionOutput,
  libraryId = DEFAULT_LIBRARY_ID,
  faceDetectionSettings?: FaceDetectionSettings,
  imageOrientationClassifier?: ImageOrientationClassifierResult | null,
): string | null {
  const db = getDesktopDatabase();
  const now = new Date().toISOString();
  const filename = path.basename(photoPath);

  const settings = faceDetectionSettings ?? DEFAULT_FACE_DETECTION_SETTINGS;
  const detectorModelId: FaceDetectorModelId = settings.detectorModel;

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

  const faceDetectionMethod = detectorModelToFaceDetectionMethod(detectorModelId);

  const merged = mergeMetadataV2(parseJson(existingAiMetadata?.ai_metadata), {
    schema_version: "2.0",
    people: {
      face_count: result.faceCount > 0 ? result.faceCount : null,
      detections: {
        face_detection_method: faceDetectionMethod,
        image_size_for_bounding_boxes: result.imageSizeForBoundingBoxes,
        people_bounding_boxes:
          result.peopleBoundingBoxes.length > 0
            ? normalizeFaceBeingBoxes(result.peopleBoundingBoxes)
            : null,
      },
    },
    metadata_version: "desktop-photo-metadata-v2",
    file_data: {
      metadata_extracted_at: now,
    },
  });
  sanitizeLegacyPeopleShape(merged as Record<string, unknown>);

  merged.edit_suggestions = stripRotateEditSuggestions(merged.edit_suggestions);

  const nextAiMetadata = JSON.stringify(merged);

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE media_items
       SET ai_metadata = ?, face_detection_processed_at = ?,
           people_detected = ?,
           face_detection_failed_at = NULL, face_detection_error = NULL,
           deleted_at = NULL, updated_at = ?
       WHERE id = ?`,
    ).run(
      nextAiMetadata,
      now,
      result.faceCount > 0 ? result.faceCount : null,
      now,
      mediaItem.id,
    );

    const existingAutoRows = db
      .prepare(
        `SELECT id, tag_id, cluster_id, bbox_x, bbox_y, bbox_width, bbox_height,
                bbox_ref_width, bbox_ref_height
         FROM media_face_instances
         WHERE library_id = ? AND media_item_id = ? AND source = 'auto'`,
      )
      .all(libraryId, mediaItem.id) as ExistingFaceRow[];

    const imageSize = result.imageSizeForBoundingBoxes ?? null;

    const newBoxesForMatching = result.faces.map((face, idx) => ({
      item: { face, idx },
      box: {
        x1: face.bbox_xyxy[0],
        y1: face.bbox_xyxy[1],
        x2: face.bbox_xyxy[2],
        y2: face.bbox_xyxy[3],
      } as PixelXyxyBox,
    }));

    const oldBoxesForMatching = existingAutoRows
      .map((row, idx) => {
        if (
          row.bbox_x == null ||
          row.bbox_y == null ||
          row.bbox_width == null ||
          row.bbox_height == null
        ) {
          return null;
        }
        return {
          item: { row, idx },
          box: rescaleBoxToImageSize(
            {
              x: row.bbox_x,
              y: row.bbox_y,
              width: row.bbox_width,
              height: row.bbox_height,
              refWidth: row.bbox_ref_width,
              refHeight: row.bbox_ref_height,
            },
            imageSize,
          ),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    const matches = greedyMatchBoxesByIou(
      newBoxesForMatching,
      oldBoxesForMatching,
      settings.preserveTaggedFacesMinIoU,
    );

    const matchedOriginalRowIndices = new Set<number>();
    for (const m of matches.values()) {
      const matchedEntry = oldBoxesForMatching[m.oldIndex];
      matchedOriginalRowIndices.add(matchedEntry.item.idx);
    }

    const rowIdsToDelete = new Set<string>();
    for (let i = 0; i < existingAutoRows.length; i++) {
      const row = existingAutoRows[i];
      const isMatched = matchedOriginalRowIndices.has(i);
      const keepAsTaggedUnmatched =
        !isMatched && settings.keepUnmatchedTaggedFaces && row.tag_id !== null;
      if (!keepAsTaggedUnmatched) {
        rowIdsToDelete.add(row.id);
      }
    }

    if (rowIdsToDelete.size > 0) {
      const ids = Array.from(rowIdsToDelete);
      const placeholders = ids.map(() => "?").join(", ");
      db.prepare(
        `DELETE FROM media_face_instances
         WHERE library_id = ? AND media_item_id = ? AND source = 'auto' AND id IN (${placeholders})`,
      ).run(libraryId, mediaItem.id, ...ids);
    }

    const insertFace = db.prepare(
      `INSERT INTO media_face_instances (
        id,
        library_id,
        media_item_id,
        source,
        tag_id,
        cluster_id,
        confidence,
        bbox_x,
        bbox_y,
        bbox_width,
        bbox_height,
        bbox_ref_width,
        bbox_ref_height,
        bbox_area_image_ratio,
        bbox_short_side_ratio_to_largest,
        subject_role,
        detector_model,
        landmarks_json,
        estimated_age_years,
        estimated_gender,
        age_gender_confidence,
        age_gender_model,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, 'auto', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const refW = result.imageSizeForBoundingBoxes?.width ?? null;
    const refH = result.imageSizeForBoundingBoxes?.height ?? null;

    for (let i = 0; i < result.faces.length; i++) {
      const face = result.faces[i];
      const [left, top, right, bottom] = face.bbox_xyxy;
      const landmarksJson =
        Array.isArray(face.landmarks_5) && face.landmarks_5.length === 5
          ? JSON.stringify(face.landmarks_5)
          : null;
      const preserved = matches.get(i);
      const preservedEntry = preserved ? oldBoxesForMatching[preserved.oldIndex] : null;
      const preservedRow = preservedEntry
        ? existingAutoRows[preservedEntry.item.idx]
        : null;
      insertFace.run(
        randomUUID(),
        libraryId,
        mediaItem.id,
        preservedRow?.tag_id ?? null,
        preservedRow?.cluster_id ?? null,
        face.score,
        left,
        top,
        Math.max(0, right - left),
        Math.max(0, bottom - top),
        refW,
        refH,
        face.bboxAreaImageRatio ?? null,
        face.bboxShortSideRatioToLargest ?? null,
        face.subjectRole ?? null,
        detectorModelId,
        landmarksJson,
        face.ageGender?.ageYears ?? null,
        face.ageGender?.gender ?? null,
        face.ageGender?.genderConfidence ?? null,
        face.ageGender?.model ?? null,
        now,
        now,
      );
    }
  });

  tx();
  return mediaItem.id;
}

export function upsertOrientationDetectionResult(
  photoPath: string,
  input: {
    source: "image-orientation-classifier" | "face_landmarks";
    correctionAngleClockwise: 0 | 90 | 180 | 270;
    confidence: number | null;
    model?: string | null;
  },
  libraryId = DEFAULT_LIBRARY_ID,
): string | null {
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
    .prepare(`SELECT id, ai_metadata FROM media_items WHERE library_id = ? AND source_path = ? LIMIT 1`)
    .get(libraryId, photoPath) as { id: string; ai_metadata: string | null } | undefined;
  if (!mediaItem) return null;

  const merged = mergeMetadataV2(parseJson(mediaItem.ai_metadata), {
    schema_version: "2.0",
  }) as Record<string, unknown>;

  const current = getOrientationDetectionStateByPath(photoPath, libraryId);
  const currentRank = current?.source === "image-orientation-classifier" ? 2 : current ? 1 : 0;
  const nextRank = input.source === "image-orientation-classifier" ? 2 : 1;
  if (nextRank >= currentRank) {
    merged.orientation_detection = {
      source: input.source,
      correction_angle_clockwise: input.correctionAngleClockwise,
      confidence: input.confidence,
      model: input.model ?? null,
      processed_at: now,
    };
    merged.edit_suggestions = stripRotateEditSuggestions(merged.edit_suggestions);
  }

  db.prepare(
    `UPDATE media_items SET ai_metadata = ?, updated_at = ? WHERE id = ?`,
  ).run(JSON.stringify(merged), now, mediaItem.id);
  return mediaItem.id;
}

function detectorModelToFaceDetectionMethod(
  detectorModelId: FaceDetectorModelId,
): FaceDetectionMethod {
  switch (detectorModelId) {
    case "retinaface":
      return "retinaface";
    case "yolov12n-face":
      return "yolov12n-face";
    case "yolov12s-face":
      return "yolov12s-face";
    case "yolov12m-face":
      return "yolov12m-face";
    case "yolov12l-face":
      return "yolov12l-face";
    default:
      return "unknown";
  }
}

/**
 * Merge a face-detection-sourced rotation suggestion into an existing
 * `edit_suggestions` array without clobbering unrelated suggestions
 * (e.g. rotation suggestions coming from the VLM photo-analysis pipeline,
 * or non-rotation edits). Previous rotation entries tagged with the same
 * `source` are replaced.
 */
export type RotationSuggestionSource =
  | "face_landmarks"
  | "photo-analysis"
  | "image-orientation-classifier";

function reasonForRotationSource(source: RotationSuggestionSource): string {
  switch (source) {
    case "face_landmarks":
      return "Face-landmark orientation detected during face detection.";
    case "photo-analysis":
      return "Rotation suggested by photo-analysis pipeline.";
    case "image-orientation-classifier":
      return "Image orientation classifier predicted a non-zero rotation.";
    default:
      return "Rotation suggestion.";
  }
}

export function mergeRotationEditSuggestion(
  existing: unknown,
  faceOrientation: FaceOrientationMetadata | null,
  source: RotationSuggestionSource,
): unknown[] | null {
  const filtered: unknown[] = Array.isArray(existing)
    ? existing.filter((entry) => {
        if (!entry || typeof entry !== "object") return false;
        const record = entry as Record<string, unknown>;
        if (record.edit_type !== "rotate") return true;
        return record.source !== source;
      })
    : [];

  if (faceOrientation && faceOrientation.correction_angle_clockwise !== 0) {
    filtered.push({
      edit_type: "rotate",
      source,
      priority: "high",
      reason: reasonForRotationSource(source),
      confidence: faceOrientation.confidence ?? null,
      auto_apply_safe: true,
      rotation: {
        angle_degrees_clockwise: faceOrientation.correction_angle_clockwise,
      },
    });
  }

  return filtered.length > 0 ? filtered : null;
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

    const rotMerged = mergeMetadataV2(parseJson(existingAiMetadata?.ai_metadata), {
      schema_version: "2.0",
      people: {
        face_count: faces.faceCount > 0 ? faces.faceCount : null,
        detections: {
          face_detection_method: "retinaface",
          image_size_for_bounding_boxes: faces.imageSizeForBoundingBoxes,
          people_bounding_boxes:
            faces.peopleBoundingBoxes.length > 0
              ? normalizeFaceBeingBoxes(faces.peopleBoundingBoxes)
              : null,
        },
      },
      metadata_version: "desktop-photo-metadata-v2",
      file_data: {
        metadata_extracted_at: now,
      },
    });
    sanitizeLegacyPeopleShape(rotMerged as Record<string, unknown>);

    rotMerged.edit_suggestions = stripRotateEditSuggestions(rotMerged.edit_suggestions);

    const nextAiMetadata = JSON.stringify(rotMerged);

    db.prepare(
      `UPDATE media_items
       SET ai_metadata = ?, face_detection_processed_at = ?, people_detected = ?, updated_at = ?
       WHERE id = ?`,
    ).run(nextAiMetadata, now, faces.faceCount > 0 ? faces.faceCount : null, now, mediaItem.id);

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
    person_face_bounding_box: normalizeFaceBoxForMetadata(box.person_face_bounding_box ?? null),
    provider_raw_bounding_box: box.provider_raw_bounding_box ?? undefined,
    detected_features: box.detected_features ?? null,
  }));
}

function normalizeFaceBoxForMetadata(
  box: FaceDetectionOutput["peopleBoundingBoxes"][number]["person_face_bounding_box"] | null,
) {
  if (!box || typeof box !== "object") {
    return box ?? null;
  }
  const rounded = { ...box } as Record<string, unknown>;
  if (typeof rounded.width === "number") {
    rounded.width = Math.round(rounded.width);
  }
  if (typeof rounded.height === "number") {
    rounded.height = Math.round(rounded.height);
  }
  if (typeof rounded.x === "number") {
    rounded.x = Math.round(rounded.x);
  }
  if (typeof rounded.y === "number") {
    rounded.y = Math.round(rounded.y);
  }
  if (typeof rounded.x_min === "number") {
    rounded.x_min = Math.round(rounded.x_min);
  }
  if (typeof rounded.y_min === "number") {
    rounded.y_min = Math.round(rounded.y_min);
  }
  if (typeof rounded.x_max === "number") {
    rounded.x_max = Math.round(rounded.x_max);
  }
  if (typeof rounded.y_max === "number") {
    rounded.y_max = Math.round(rounded.y_max);
  }
  if (typeof rounded.mp_x === "number") {
    rounded.mp_x = Math.round(rounded.mp_x);
  }
  if (typeof rounded.mp_y === "number") {
    rounded.mp_y = Math.round(rounded.mp_y);
  }
  if (typeof rounded.mp_width === "number") {
    rounded.mp_width = Math.round(rounded.mp_width);
  }
  if (typeof rounded.mp_height === "number") {
    rounded.mp_height = Math.round(rounded.mp_height);
  }
  return rounded as typeof box;
}

function getFaceCountFromMetadata(value: unknown): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const root = value as Record<string, unknown>;
  const people = root.people;
  if (!people || typeof people !== "object") {
    return null;
  }
  const peopleRecord = people as Record<string, unknown>;
  const faceCount = peopleRecord.face_count;
  if (typeof faceCount === "number" && Number.isFinite(faceCount)) {
    return Math.max(0, Math.floor(faceCount));
  }
  const legacyCount = peopleRecord.number_of_people;
  if (typeof legacyCount === "number" && Number.isFinite(legacyCount)) {
    return Math.max(0, Math.floor(legacyCount));
  }
  return null;
}

function sanitizeLegacyPeopleShape(metadata: Record<string, unknown>): void {
  delete metadata.rotation_decision;
  delete metadata.two_pass_rotation_consistency;
  delete metadata.face_rotation_override;
  delete metadata.provenance;
  if (metadata.ai && !metadata.image_analysis) {
    metadata.image_analysis = metadata.ai;
  }
  delete metadata.ai;
  if (metadata.technical || metadata.embedded) {
    const fileData =
      metadata.file_data && typeof metadata.file_data === "object"
        ? (metadata.file_data as Record<string, unknown>)
        : {};
    if (metadata.technical && fileData.technical === undefined) {
      fileData.technical = metadata.technical;
    }
    if (metadata.embedded && fileData.exif_xmp === undefined) {
      fileData.exif_xmp = metadata.embedded;
    }
    metadata.file_data = fileData;
  }
  delete metadata.technical;
  delete metadata.embedded;
  const peopleNode = metadata.people;
  if (!peopleNode || typeof peopleNode !== "object") {
    return;
  }
  const people = peopleNode as Record<string, unknown>;
  const legacyNumber = people.number_of_people;
  const legacyHasChildren = people.has_children;
  const legacyPeopleDetected = people.people_detected;

  const existingVlm =
    people.vlm_analysis && typeof people.vlm_analysis === "object"
      ? (people.vlm_analysis as Record<string, unknown>)
      : {};

  if (
    existingVlm.number_of_people === undefined &&
    typeof legacyNumber === "number" &&
    Number.isFinite(legacyNumber)
  ) {
    existingVlm.number_of_people = Math.max(0, Math.floor(legacyNumber));
  }
  if (existingVlm.has_children === undefined && typeof legacyHasChildren === "boolean") {
    existingVlm.has_children = legacyHasChildren;
  }
  if (existingVlm.people_detected === undefined && Array.isArray(legacyPeopleDetected)) {
    existingVlm.people_detected = legacyPeopleDetected;
  }
  if (
    (people.face_count === undefined || people.face_count === null) &&
    typeof legacyNumber === "number" &&
    Number.isFinite(legacyNumber)
  ) {
    people.face_count = Math.max(0, Math.floor(legacyNumber));
  }

  people.vlm_analysis = existingVlm;
  delete people.number_of_people;
  delete people.has_children;
  delete people.people_detected;

  const detections = people.detections;
  if (detections && typeof detections === "object") {
    delete (detections as Record<string, unknown>).face_orientation;
  }
}

function stripRotateEditSuggestions(input: unknown): unknown {
  if (!Array.isArray(input)) {
    return input ?? null;
  }
  const kept = input.filter((entry) => {
    if (!entry || typeof entry !== "object") return true;
    const rec = entry as Record<string, unknown>;
    return rec.edit_type !== "rotate";
  });
  return kept.length > 0 ? kept : null;
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
    root.image_analysis && typeof root.image_analysis === "object"
      ? (root.image_analysis as Record<string, unknown>)
      : root.ai && typeof root.ai === "object"
        ? (root.ai as Record<string, unknown>)
        : root;

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

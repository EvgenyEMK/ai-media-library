import path from "node:path";
import type {
  FolderFaceSummary,
  FolderFaceSummaryReport,
  FolderFaceTopPersonTag,
} from "../../src/shared/ipc";
import { IMAGE_EXTENSIONS } from "../../src/shared/ipc";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";

function escapeLikePattern(value: string): string {
  return value.replace(/[%_~]/g, "~$&");
}

function separatorForFolderPath(folderPath: string): string {
  if (folderPath.includes("\\")) return "\\";
  if (folderPath.includes("/")) return "/";
  return path.sep;
}

function buildImageFilePredicate(): string {
  const extClauses = [...IMAGE_EXTENSIONS].map((ext) => {
    const pat = `%${ext}`.replace(/'/g, "''");
    return `lower(mi.filename) LIKE '${pat}'`;
  });
  return `(mi.mime_type LIKE 'image/%' OR ${extClauses.join(" OR ")})`;
}

function emptySummary(folderPath: string, recursive: boolean): FolderFaceSummary {
  return {
    folderPath,
    recursive,
    totalImages: 0,
    faceAnalyzedImages: 0,
    faceFailedImages: 0,
    imagesWithFaces: 0,
    detectedFaces: 0,
    confirmedTaggedFaces: 0,
    suggestedUntaggedFaces: 0,
    taggedFaces: 0,
    untaggedFaces: 0,
    imagesWithDirectPersonTag: 0,
    facesWithAgeGender: 0,
    facesMissingAgeGender: 0,
    childFaces: 0,
    adultFaces: 0,
    oneMainSubjectWithBackgroundFaces: 0,
    faceCountHistogram: {
      oneFace: 0,
      twoFaces: 0,
      threeFaces: 0,
      fourFaces: 0,
      fiveOrMoreFaces: 0,
    },
    mainSubjectHistogram: {
      oneMainSubject: 0,
      twoMainSubjects: 0,
      threeMainSubjects: 0,
      fourMainSubjects: 0,
      fiveOrMoreMainSubjects: 0,
    },
    topPersonTags: [],
  };
}

export function getFolderFaceSummary(params: {
  folderPath: string;
  recursive: boolean;
  libraryId?: string;
  topTagsLimit?: number;
}): FolderFaceSummary {
  const libraryId = params.libraryId ?? DEFAULT_LIBRARY_ID;
  const topTagsLimit = Math.max(1, Math.min(20, params.topTagsLimit ?? 10));
  const folderPath = params.folderPath?.trim();
  if (!folderPath) return emptySummary("", params.recursive);

  const sep = separatorForFolderPath(folderPath);
  const folderPrefix = folderPath.endsWith(sep) ? folderPath : `${folderPath}${sep}`;
  const likePattern = `${escapeLikePattern(folderPrefix)}%`;
  const imagePred = buildImageFilePredicate();
  const depthClause = params.recursive
    ? ""
    : `AND instr(substr(mi.source_path, length(?) + 1), ?) = 0`;
  const depthFaceClause = params.recursive
    ? ""
    : `AND instr(substr(mi.source_path, length(?) + 1), ?) = 0`;

  const db = getDesktopDatabase();
  const coreSql = `
    WITH scoped_images AS (
      SELECT mi.id, mi.source_path, mi.face_detection_processed_at, mi.face_detection_failed_at
      FROM media_items mi
      WHERE mi.library_id = ?
        AND mi.deleted_at IS NULL
        AND ${imagePred}
        AND mi.source_path LIKE ? ESCAPE '~'
        ${depthClause}
    ),
    face_per_image AS (
      SELECT
        fi.media_item_id,
        COUNT(*) AS face_count,
        SUM(CASE WHEN fi.tag_id IS NOT NULL THEN 1 ELSE 0 END) AS tagged_face_count,
        SUM(CASE WHEN fi.estimated_age_years IS NOT NULL AND fi.estimated_gender IS NOT NULL THEN 1 ELSE 0 END) AS age_gender_count,
        SUM(CASE WHEN fi.estimated_age_years IS NULL OR fi.estimated_gender IS NULL THEN 1 ELSE 0 END) AS missing_age_gender_count,
        SUM(CASE WHEN fi.estimated_age_years IS NOT NULL AND fi.estimated_age_years < 18 THEN 1 ELSE 0 END) AS child_face_count,
        SUM(CASE WHEN fi.estimated_age_years IS NOT NULL AND fi.estimated_age_years >= 18 THEN 1 ELSE 0 END) AS adult_face_count,
        SUM(CASE WHEN fi.subject_role = 'main' THEN 1 ELSE 0 END) AS main_face_count
      FROM media_face_instances fi
      INNER JOIN scoped_images si ON si.id = fi.media_item_id
      WHERE fi.library_id = ?
      GROUP BY fi.media_item_id
    ),
    direct_person_tags AS (
      SELECT COUNT(DISTINCT mit.media_item_id) AS direct_person_tag_images
      FROM media_item_tags mit
      INNER JOIN media_tags mt
        ON mt.id = mit.tag_id
       AND mt.library_id = mit.library_id
       AND mt.tag_type = 'person'
      INNER JOIN scoped_images si ON si.id = mit.media_item_id
      WHERE mit.library_id = ?
    ),
    suggested_untagged_faces AS (
      SELECT COUNT(DISTINCT ps.exemplar_face_instance_id) AS suggested_untagged_faces
      FROM media_item_person_suggestions ps
      INNER JOIN scoped_images si ON si.id = ps.media_item_id
      INNER JOIN media_face_instances fi
        ON fi.id = ps.exemplar_face_instance_id
       AND fi.library_id = ps.library_id
       AND fi.media_item_id = ps.media_item_id
      WHERE ps.library_id = ?
        AND ps.exemplar_face_instance_id IS NOT NULL
        AND fi.tag_id IS NULL
    )
    SELECT
      (SELECT COUNT(*) FROM scoped_images) AS total_images,
      (SELECT COUNT(*) FROM scoped_images si
       WHERE si.face_detection_processed_at IS NOT NULL
         AND (si.face_detection_failed_at IS NULL OR si.face_detection_processed_at > si.face_detection_failed_at)) AS face_analyzed_images,
      (SELECT COUNT(*) FROM scoped_images si
       WHERE si.face_detection_failed_at IS NOT NULL
         AND (si.face_detection_processed_at IS NULL OR si.face_detection_failed_at >= si.face_detection_processed_at)) AS face_failed_images,
      COUNT(fpi.media_item_id) AS images_with_faces,
      COALESCE(SUM(fpi.face_count), 0) AS detected_faces,
      COALESCE(SUM(fpi.tagged_face_count), 0) AS tagged_faces,
      COALESCE(SUM(fpi.age_gender_count), 0) AS faces_with_age_gender,
      COALESCE(SUM(fpi.missing_age_gender_count), 0) AS faces_missing_age_gender,
      COALESCE(SUM(fpi.child_face_count), 0) AS child_faces,
      COALESCE(SUM(fpi.adult_face_count), 0) AS adult_faces,
      COALESCE(SUM(CASE WHEN fpi.face_count = 1 THEN 1 ELSE 0 END), 0) AS one_face_images,
      COALESCE(SUM(CASE WHEN fpi.face_count = 2 THEN 1 ELSE 0 END), 0) AS two_face_images,
      COALESCE(SUM(CASE WHEN fpi.face_count = 3 THEN 1 ELSE 0 END), 0) AS three_face_images,
      COALESCE(SUM(CASE WHEN fpi.face_count = 4 THEN 1 ELSE 0 END), 0) AS four_face_images,
      COALESCE(SUM(CASE WHEN fpi.face_count >= 5 THEN 1 ELSE 0 END), 0) AS five_plus_face_images,
      COALESCE(SUM(CASE WHEN (CASE WHEN fpi.main_face_count > 0 THEN fpi.main_face_count ELSE fpi.face_count END) = 1 THEN 1 ELSE 0 END), 0) AS one_main_subject_images,
      COALESCE(SUM(CASE WHEN (CASE WHEN fpi.main_face_count > 0 THEN fpi.main_face_count ELSE fpi.face_count END) = 2 THEN 1 ELSE 0 END), 0) AS two_main_subject_images,
      COALESCE(SUM(CASE WHEN (CASE WHEN fpi.main_face_count > 0 THEN fpi.main_face_count ELSE fpi.face_count END) = 3 THEN 1 ELSE 0 END), 0) AS three_main_subject_images,
      COALESCE(SUM(CASE WHEN (CASE WHEN fpi.main_face_count > 0 THEN fpi.main_face_count ELSE fpi.face_count END) = 4 THEN 1 ELSE 0 END), 0) AS four_main_subject_images,
      COALESCE(SUM(CASE WHEN (CASE WHEN fpi.main_face_count > 0 THEN fpi.main_face_count ELSE fpi.face_count END) >= 5 THEN 1 ELSE 0 END), 0) AS five_plus_main_subject_images,
      COALESCE(SUM(CASE WHEN fpi.face_count > 1 AND fpi.main_face_count = 1 THEN 1 ELSE 0 END), 0) AS one_main_with_background_images,
      (SELECT direct_person_tag_images FROM direct_person_tags) AS direct_person_tag_images,
      (SELECT suggested_untagged_faces FROM suggested_untagged_faces) AS suggested_untagged_faces
    FROM face_per_image fpi
  `;

  const coreArgs: unknown[] = [libraryId, likePattern];
  if (!params.recursive) coreArgs.push(folderPrefix, sep);
  coreArgs.push(libraryId, libraryId, libraryId);
  const row = db.prepare(coreSql).get(...coreArgs) as {
    total_images: number | null;
    face_analyzed_images: number | null;
    face_failed_images: number | null;
    images_with_faces: number | null;
    detected_faces: number | null;
    tagged_faces: number | null;
    faces_with_age_gender: number | null;
    faces_missing_age_gender: number | null;
    child_faces: number | null;
    adult_faces: number | null;
    one_face_images: number | null;
    two_face_images: number | null;
    three_face_images: number | null;
    four_face_images: number | null;
    five_plus_face_images: number | null;
    one_main_subject_images: number | null;
    two_main_subject_images: number | null;
    three_main_subject_images: number | null;
    four_main_subject_images: number | null;
    five_plus_main_subject_images: number | null;
    one_main_with_background_images: number | null;
    direct_person_tag_images: number | null;
    suggested_untagged_faces: number | null;
  };

  const topTagsSql = `
    SELECT
      mt.id AS tag_id,
      mt.name AS tag_name,
      COUNT(*) AS tagged_face_count,
      COALESCE(pc.similar_untagged_face_count, 0) AS similar_face_count
    FROM media_face_instances fi
    INNER JOIN media_items mi
      ON mi.id = fi.media_item_id
     AND mi.library_id = fi.library_id
    INNER JOIN media_tags mt
      ON mt.id = fi.tag_id
     AND mt.library_id = fi.library_id
     AND mt.tag_type = 'person'
    LEFT JOIN person_centroids pc
      ON pc.tag_id = mt.id
     AND pc.library_id = mt.library_id
    WHERE fi.library_id = ?
      AND mi.deleted_at IS NULL
      AND fi.tag_id IS NOT NULL
      AND ${imagePred}
      AND mi.source_path LIKE ? ESCAPE '~'
      ${depthFaceClause}
    GROUP BY mt.id, mt.name, pc.similar_untagged_face_count
    ORDER BY tagged_face_count DESC, mt.name COLLATE NOCASE ASC
    LIMIT ?
  `;
  const topArgs: unknown[] = [libraryId, likePattern];
  if (!params.recursive) topArgs.push(folderPrefix, sep);
  topArgs.push(topTagsLimit);
  const topRows = db.prepare(topTagsSql).all(...topArgs) as Array<{
    tag_id: string;
    tag_name: string;
    tagged_face_count: number;
    similar_face_count: number;
  }>;

  const totalImages = Number(row?.total_images ?? 0);
  const taggedFaces = Number(row?.tagged_faces ?? 0);
  const detectedFaces = Number(row?.detected_faces ?? 0);
  const topPersonTags: FolderFaceTopPersonTag[] = topRows.map((tagRow) => ({
    tagId: tagRow.tag_id,
    label: tagRow.tag_name,
    taggedFaceCount: Number(tagRow.tagged_face_count ?? 0),
    similarFaceCount: Number(tagRow.similar_face_count ?? 0),
  }));

  return {
    folderPath,
    recursive: params.recursive,
    totalImages,
    faceAnalyzedImages: Number(row?.face_analyzed_images ?? 0),
    faceFailedImages: Number(row?.face_failed_images ?? 0),
    imagesWithFaces: Number(row?.images_with_faces ?? 0),
    detectedFaces,
    confirmedTaggedFaces: taggedFaces,
    suggestedUntaggedFaces: Number(row?.suggested_untagged_faces ?? 0),
    taggedFaces,
    untaggedFaces: Math.max(0, detectedFaces - taggedFaces),
    imagesWithDirectPersonTag: Number(row?.direct_person_tag_images ?? 0),
    facesWithAgeGender: Number(row?.faces_with_age_gender ?? 0),
    facesMissingAgeGender: Number(row?.faces_missing_age_gender ?? 0),
    childFaces: Number(row?.child_faces ?? 0),
    adultFaces: Number(row?.adult_faces ?? 0),
    oneMainSubjectWithBackgroundFaces: Number(row?.one_main_with_background_images ?? 0),
    faceCountHistogram: {
      oneFace: Number(row?.one_face_images ?? 0),
      twoFaces: Number(row?.two_face_images ?? 0),
      threeFaces: Number(row?.three_face_images ?? 0),
      fourFaces: Number(row?.four_face_images ?? 0),
      fiveOrMoreFaces: Number(row?.five_plus_face_images ?? 0),
    },
    mainSubjectHistogram: {
      oneMainSubject: Number(row?.one_main_subject_images ?? 0),
      twoMainSubjects: Number(row?.two_main_subject_images ?? 0),
      threeMainSubjects: Number(row?.three_main_subject_images ?? 0),
      fourMainSubjects: Number(row?.four_main_subject_images ?? 0),
      fiveOrMoreMainSubjects: Number(row?.five_plus_main_subject_images ?? 0),
    },
    topPersonTags,
  };
}

export function getFolderFaceSummaryReport(params: {
  folderPath: string;
  libraryId?: string;
  subfolderPaths: Array<{ folderPath: string; name: string }>;
}): FolderFaceSummaryReport {
  const normalized = params.folderPath?.trim();
  if (!normalized) {
    return {
      selectedWithSubfolders: emptySummary("", true),
      selectedDirectOnly: emptySummary("", false),
      subfolders: [],
    };
  }
  return {
    selectedWithSubfolders: getFolderFaceSummary({
      folderPath: normalized,
      recursive: true,
      libraryId: params.libraryId,
    }),
    selectedDirectOnly: getFolderFaceSummary({
      folderPath: normalized,
      recursive: false,
      libraryId: params.libraryId,
    }),
    subfolders: params.subfolderPaths.map((node) => ({
      folderPath: node.folderPath,
      name: node.name,
      summary: getFolderFaceSummary({
        folderPath: node.folderPath,
        recursive: true,
        libraryId: params.libraryId,
      }),
    })),
  };
}

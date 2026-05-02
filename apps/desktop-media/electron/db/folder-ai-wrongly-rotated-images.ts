import path from "node:path";
import { pathToFileURL } from "node:url";
import { IMAGE_EXTENSIONS, type FolderAiWronglyRotatedImagesPageResult, type RelativeCropBox } from "../../src/shared/ipc";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";

interface WronglyRotatedImageRow {
  id: string;
  source_path: string;
  filename: string | null;
  ai_metadata: string | null;
}

interface ParsedAiMetadata {
  rotationAngleClockwise: 90 | 180 | 270 | null;
  cropRel: RelativeCropBox | null;
}

export interface WronglyRotatedImagesQueryParts {
  whereSql: string;
  whereArgs: string[];
}

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

export function buildWronglyRotatedImagesQueryParts(params: {
  folderPath: string;
  recursive: boolean;
  libraryId?: string;
}): WronglyRotatedImagesQueryParts {
  const libraryId = params.libraryId ?? DEFAULT_LIBRARY_ID;
  const sep = separatorForFolderPath(params.folderPath);
  const folderPrefix = params.folderPath.endsWith(sep) ? params.folderPath : `${params.folderPath}${sep}`;
  const likePattern = `${escapeLikePattern(folderPrefix)}%`;
  const depthClause = params.recursive
    ? ""
    : `AND instr(substr(mi.source_path, length(?) + 1), ?) = 0`;

  return {
    whereSql: `
      WHERE mi.library_id = ?
        AND mi.deleted_at IS NULL
        AND ${buildImageFilePredicate()}
        AND mi.source_path LIKE ? ESCAPE '~'
        ${depthClause}
        AND CAST(json_extract(mi.ai_metadata, '$.orientation_detection.correction_angle_clockwise') AS INTEGER) IN (90, 180, 270)
        AND (
          json_extract(mi.ai_metadata, '$.orientation_detection_error') IS NULL
          OR json_extract(mi.ai_metadata, '$.orientation_detection.processed_at') > json_extract(mi.ai_metadata, '$.orientation_detection_error.failed_at')
        )
    `,
    whereArgs: params.recursive
      ? [libraryId, likePattern]
      : [libraryId, likePattern, folderPrefix, sep],
  };
}

function parseCropRel(value: unknown): RelativeCropBox | null {
  if (!value || typeof value !== "object") return null;
  const crop = value as Record<string, unknown>;
  if (
    typeof crop.x === "number" &&
    typeof crop.y === "number" &&
    typeof crop.width === "number" &&
    typeof crop.height === "number"
  ) {
    return {
      x: crop.x,
      y: crop.y,
      width: crop.width,
      height: crop.height,
    };
  }
  return null;
}

function parseAiMetadata(raw: string | null): ParsedAiMetadata {
  if (!raw) {
    return { rotationAngleClockwise: null, cropRel: null };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { rotationAngleClockwise: null, cropRel: null };
    }
    const metadata = parsed as Record<string, unknown>;
    const orientation =
      metadata.orientation_detection && typeof metadata.orientation_detection === "object"
        ? (metadata.orientation_detection as Record<string, unknown>)
        : null;
    const angle = orientation?.correction_angle_clockwise;
    const rotationAngleClockwise = angle === 90 || angle === 180 || angle === 270 ? angle : null;
    const suggestions = Array.isArray(metadata.edit_suggestions) ? metadata.edit_suggestions : [];
    const cropSuggestion = suggestions.find(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) &&
        typeof entry === "object" &&
        (entry as Record<string, unknown>).edit_type === "crop",
    );

    return {
      rotationAngleClockwise,
      cropRel: parseCropRel(cropSuggestion?.crop_rel),
    };
  } catch {
    return { rotationAngleClockwise: null, cropRel: null };
  }
}

function relativeFolderPath(rootFolderPath: string, sourcePath: string): string | null {
  const relative = path.relative(path.normalize(rootFolderPath), path.dirname(path.normalize(sourcePath)));
  return relative && relative !== "." ? relative : null;
}

export function getWronglyRotatedImagesPage(params: {
  folderPath: string;
  recursive: boolean;
  page: number;
  pageSize: number;
  libraryId?: string;
}): FolderAiWronglyRotatedImagesPageResult {
  const folderPath = params.folderPath.trim();
  const pageSize = Math.min(100, Math.max(1, Math.round(params.pageSize) || 24));
  const page = Math.max(1, Math.round(params.page) || 1);
  if (!folderPath) {
    return { items: [], total: 0, page, pageSize };
  }

  const db = getDesktopDatabase();
  const { whereSql, whereArgs } = buildWronglyRotatedImagesQueryParts({
    folderPath,
    recursive: params.recursive,
    libraryId: params.libraryId,
  });
  const totalRow = db.prepare(`SELECT COUNT(*) AS total FROM media_items mi ${whereSql}`).get(...whereArgs) as
    | { total?: number | bigint | null }
    | undefined;
  const total = Number(totalRow?.total ?? 0);
  const offset = (page - 1) * pageSize;
  const rows = db
    .prepare(
      `SELECT mi.id, mi.source_path, mi.filename, mi.ai_metadata
       FROM media_items mi
       ${whereSql}
       ORDER BY mi.source_path COLLATE NOCASE ASC
       LIMIT ? OFFSET ?`,
    )
    .all(...whereArgs, pageSize, offset) as WronglyRotatedImageRow[];

  return {
    total,
    page,
    pageSize,
    items: rows.flatMap((row) => {
      const parsed = parseAiMetadata(row.ai_metadata);
      if (parsed.rotationAngleClockwise === null) {
        return [];
      }
      return [
        {
          id: row.id,
          sourcePath: row.source_path,
          name: row.filename?.trim() || path.basename(row.source_path),
          imageUrl: pathToFileURL(row.source_path).toString(),
          folderPathRelative: relativeFolderPath(folderPath, row.source_path),
          rotationAngleClockwise: parsed.rotationAngleClockwise,
          cropRel: parsed.cropRel,
        },
      ];
    }),
  };
}

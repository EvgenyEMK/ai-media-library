import path from "node:path";
import { ipcMain } from "electron";
import {
  IPC_CHANNELS,
  inferCatalogMediaKind,
  type FolderAiFailedFileItem,
  type FolderAiPipelineKind,
  type FolderAiSummaryOverviewRequestOptions,
  type FolderAiSummaryOverviewReport,
  type FolderAiSummaryReport,
} from "../../src/shared/ipc";
import { getDesktopDatabase } from "../db/client";
import { getFolderAiCoverage, getFolderAiRollupsForPaths } from "../db/folder-ai-coverage";
import {
  getFolderMetadataScanCompletedAtByPath,
  getFolderSummaryOverview,
} from "../db/folder-summary-overview";
import { readFolderChildren } from "../fs-media";
import { MULTIMODAL_EMBED_MODEL } from "../semantic-embeddings";

export function registerFolderAiSummaryHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.getFolderAiSummaryOverview,
    async (
      _event,
      folderPath: string,
      options?: FolderAiSummaryOverviewRequestOptions,
    ): Promise<FolderAiSummaryOverviewReport> => {
      const normalized = folderPath?.trim();
      if (!normalized) {
        return {
          selectedWithSubfolders: getFolderSummaryOverview({ folderPath: "", recursive: true }),
          selectedDirectOnly: getFolderSummaryOverview({ folderPath: "", recursive: false }),
          subfolders: [],
        };
      }

      const includeSubfolders = options?.includeSubfolders !== false;
      const children = includeSubfolders ? await readFolderChildren(normalized) : [];
      const subfolders = includeSubfolders
        ? children.map((node) => ({
            folderPath: node.path,
            name: node.name,
            overview: getFolderSummaryOverview({ folderPath: node.path, recursive: true }),
          }))
        : [];
      const directSubfolderScanCompletedAtByPath = getFolderMetadataScanCompletedAtByPath(
        children.map((node) => node.path),
      );
      const notFullyScannedDirectSubfolderCount = children.filter(
        (node) => directSubfolderScanCompletedAtByPath[node.path] == null,
      ).length;
      const selectedWithSubfolders = getFolderSummaryOverview({ folderPath: normalized, recursive: true });
      selectedWithSubfolders.scanFreshness.notFullyScannedDirectSubfolderCount =
        notFullyScannedDirectSubfolderCount;
      return {
        selectedWithSubfolders,
        selectedDirectOnly: getFolderSummaryOverview({ folderPath: normalized, recursive: false }),
        subfolders,
      };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.getFolderAiSummaryReport,
    async (_event, folderPath: string): Promise<FolderAiSummaryReport> => {
      const normalized = folderPath?.trim();
      if (!normalized) {
        return {
          selectedWithSubfolders: getFolderAiCoverage({ folderPath: "", recursive: true }),
          selectedDirectOnly: getFolderAiCoverage({ folderPath: "", recursive: false }),
          subfolders: [],
        };
      }

      const selectedWithSubfolders = getFolderAiCoverage({ folderPath: normalized, recursive: true });
      const selectedDirectOnly = getFolderAiCoverage({ folderPath: normalized, recursive: false });
      const children = await readFolderChildren(normalized);
      const subfolders = children.map((node) => ({
        folderPath: node.path,
        name: node.name,
        coverage: getFolderAiCoverage({ folderPath: node.path, recursive: true }),
      }));

      return { selectedWithSubfolders, selectedDirectOnly, subfolders };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.getFolderAiCoverage,
    async (_event, folderPath: string, recursive: boolean) => {
      const normalized = folderPath?.trim() ?? "";
      return getFolderAiCoverage({ folderPath: normalized, recursive: recursive === true });
    },
  );

  ipcMain.handle(IPC_CHANNELS.getFolderAiRollupsBatch, async (_event, folderPaths: unknown) => {
    if (!Array.isArray(folderPaths)) {
      return {};
    }
    const paths = folderPaths.filter((p): p is string => typeof p === "string");
    return getFolderAiRollupsForPaths(paths);
  });

  ipcMain.handle(
    IPC_CHANNELS.getFolderAiFailedFiles,
    async (
      _event,
      folderPath: string,
      pipeline: FolderAiPipelineKind,
      recursive: boolean,
    ): Promise<FolderAiFailedFileItem[]> => {
      const normalized = folderPath?.trim();
      if (!normalized) return [];
      const db = getDesktopDatabase();
      const { whereSql, whereArgs } = buildFolderWhere("mi.source_path", normalized, recursive === true);
      let rows: Array<{
        source_path: string;
        filename: string | null;
        mime_type: string | null;
        failed_at: string | null;
        error_text: string | null;
      }> = [];

      if (pipeline === "photo") {
        rows = db
          .prepare(
            `SELECT
               mi.source_path,
               mi.filename,
               mi.mime_type,
               mi.photo_analysis_failed_at AS failed_at,
               mi.photo_analysis_error AS error_text
             FROM media_items mi
             WHERE mi.photo_analysis_failed_at IS NOT NULL
               AND (
                 mi.photo_analysis_processed_at IS NULL
                 OR mi.photo_analysis_failed_at >= mi.photo_analysis_processed_at
               )
               ${whereSql}
             ORDER BY mi.photo_analysis_failed_at DESC, mi.source_path COLLATE NOCASE ASC`,
          )
          .all(...whereArgs) as typeof rows;
      } else if (pipeline === "face") {
        rows = db
          .prepare(
            `SELECT
               mi.source_path,
               mi.filename,
               mi.mime_type,
               mi.face_detection_failed_at AS failed_at,
               mi.face_detection_error AS error_text
             FROM media_items mi
             WHERE mi.face_detection_failed_at IS NOT NULL
               AND (
                 mi.face_detection_processed_at IS NULL
                 OR mi.face_detection_failed_at >= mi.face_detection_processed_at
               )
               ${whereSql}
             ORDER BY mi.face_detection_failed_at DESC, mi.source_path COLLATE NOCASE ASC`,
          )
          .all(...whereArgs) as typeof rows;
      } else {
        rows = db
          .prepare(
            `SELECT
               mi.source_path,
               mi.filename,
               mi.mime_type,
               me.updated_at AS failed_at,
               me.last_error AS error_text
             FROM media_embeddings me
             INNER JOIN media_items mi ON mi.id = me.media_item_id
             WHERE me.embedding_type = 'image'
               AND me.model_version = ?
               AND me.embedding_status = 'failed'
               ${whereSql}
             ORDER BY me.updated_at DESC, mi.source_path COLLATE NOCASE ASC`,
          )
          .all(MULTIMODAL_EMBED_MODEL, ...whereArgs) as typeof rows;
      }

      return rows.map((row) => ({
        path: row.source_path,
        name: row.filename?.trim() || path.basename(row.source_path),
        mediaKind: inferCatalogMediaKind(row.source_path, row.mime_type),
        failedAt: row.failed_at,
        error: row.error_text,
      }));
    },
  );
}

function buildFolderWhere(
  sourcePathField: string,
  folderPath: string,
  recursive: boolean,
): { whereSql: string; whereArgs: string[] } {
  const sep = folderPath.includes("/") ? "/" : "\\";
  const folderPrefix = folderPath.endsWith(sep) ? folderPath : `${folderPath}${sep}`;
  const escapedPrefix = folderPrefix.replace(/[%_~]/g, "~$&") + "%";
  if (recursive) {
    return {
      whereSql: `AND ${sourcePathField} LIKE ? ESCAPE '~'`,
      whereArgs: [escapedPrefix],
    };
  }
  return {
    whereSql:
      `AND ${sourcePathField} LIKE ? ESCAPE '~' ` +
      `AND instr(substr(${sourcePathField}, length(?) + 1), ?) = 0`,
    whereArgs: [escapedPrefix, folderPrefix, sep],
  };
}

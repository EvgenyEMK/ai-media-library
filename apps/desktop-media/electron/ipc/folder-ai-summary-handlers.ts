import path from "node:path";
import { performance } from "node:perf_hooks";
import { ipcMain } from "electron";
import {
  IPC_CHANNELS,
  inferCatalogMediaKind,
  type FolderAiFailedFileItem,
  type FolderAiPipelineKind,
  type FolderAiSummaryOverviewRequestOptions,
  type FolderAiSummaryOverviewReport,
  type FolderAiSummaryReport,
  type FolderTreeScanSummary,
} from "../../src/shared/ipc";
import { getDesktopDatabase } from "../db/client";
import { getFolderAiCoverage, getFolderAiRollupsForPaths } from "../db/folder-ai-coverage";
import {
  getFolderMetadataScanCompletedAtByPath,
  getFolderSummaryOverview,
} from "../db/folder-summary-overview";
import { readDirectFolderChildren, readFolderChildren } from "../fs-media";
import { MULTIMODAL_EMBED_MODEL } from "../semantic-embeddings";

const DEBUG_FOLDER_AI_SUMMARY = true;

function debugFolderAiSummary(message: string, details?: Record<string, unknown>): void {
  if (!DEBUG_FOLDER_AI_SUMMARY) return;
  console.log("[debug][folder-ai-summary]", message, details ?? {});
}

function elapsedSince(startedAt: number): string {
  return `${Math.round(performance.now() - startedAt)}ms`;
}

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
          hasDirectSubfolders: false,
          subfolders: [],
        };
      }

      const startedAt = performance.now();
      const includeSubfolders = options?.includeSubfolders !== false;
      const includeSubfolderOverviews = options?.includeSubfolderOverviews === true;
      debugFolderAiSummary("overview:start", { folderPath: normalized, includeSubfolders, includeSubfolderOverviews });

      const selectedStartedAt = performance.now();
      const selectedWithSubfolders = getFolderSummaryOverview({ folderPath: normalized, recursive: true });
      const selectedDirectOnly = getFolderSummaryOverview({ folderPath: normalized, recursive: false });
      debugFolderAiSummary("overview:selected-complete", {
        folderPath: normalized,
        elapsed: elapsedSince(selectedStartedAt),
        totalImages: selectedWithSubfolders.totalImages,
        totalVideos: selectedWithSubfolders.totalVideos,
      });

      const childrenStartedAt = performance.now();
      const children = includeSubfolders ? await readDirectFolderChildren(normalized) : [];
      debugFolderAiSummary("overview:children-complete", {
        folderPath: normalized,
        elapsed: elapsedSince(childrenStartedAt),
        directSubfolders: children.length,
      });

      const subfolders = includeSubfolders && includeSubfolderOverviews
        ? children.map((node) => ({
            folderPath: node.path,
            name: node.name,
            overview: getFolderSummaryOverview({ folderPath: node.path, recursive: true }),
          }))
        : [];
      if (includeSubfolders && includeSubfolderOverviews) {
        debugFolderAiSummary("overview:subfolder-overviews-complete", {
          folderPath: normalized,
          elapsed: elapsedSince(childrenStartedAt),
          directSubfolders: subfolders.length,
        });
      }

      const directScanStartedAt = performance.now();
      const directSubfolderScanCompletedAtByPath = getFolderMetadataScanCompletedAtByPath(
        children.map((node) => node.path),
      );
      const notFullyScannedDirectSubfolderCount = children.filter(
        (node) => directSubfolderScanCompletedAtByPath[node.path] == null,
      ).length;
      selectedWithSubfolders.scanFreshness.notFullyScannedDirectSubfolderCount =
        notFullyScannedDirectSubfolderCount;
      debugFolderAiSummary("overview:direct-scan-complete", {
        folderPath: normalized,
        elapsed: elapsedSince(directScanStartedAt),
        notFullyScannedDirectSubfolderCount,
      });
      debugFolderAiSummary("overview:complete", { folderPath: normalized, elapsed: elapsedSince(startedAt) });

      return {
        selectedWithSubfolders,
        selectedDirectOnly,
        hasDirectSubfolders: children.length > 0,
        subfolders,
      };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.getFolderTreeScanSummary,
    async (_event, folderPath: string): Promise<FolderTreeScanSummary> => {
      const normalized = folderPath?.trim();
      if (!normalized) {
        return { hasDirectSubfolders: false, notFullyScannedDirectSubfolderCount: 0 };
      }

      const startedAt = performance.now();
      debugFolderAiSummary("tree-scan:start", { folderPath: normalized });
      const childrenStartedAt = performance.now();
      const children = await readDirectFolderChildren(normalized);
      debugFolderAiSummary("tree-scan:children-complete", {
        folderPath: normalized,
        elapsed: elapsedSince(childrenStartedAt),
        directSubfolders: children.length,
      });

      const directScanStartedAt = performance.now();
      const directSubfolderScanCompletedAtByPath = getFolderMetadataScanCompletedAtByPath(
        children.map((node) => node.path),
      );
      const notFullyScannedDirectSubfolderCount = children.filter(
        (node) => directSubfolderScanCompletedAtByPath[node.path] == null,
      ).length;
      debugFolderAiSummary("tree-scan:complete", {
        folderPath: normalized,
        elapsed: elapsedSince(startedAt),
        directScanElapsed: elapsedSince(directScanStartedAt),
        directSubfolders: children.length,
        notFullyScannedDirectSubfolderCount,
      });

      return {
        hasDirectSubfolders: children.length > 0,
        notFullyScannedDirectSubfolderCount,
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

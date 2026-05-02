import { randomUUID } from "node:crypto";
import path from "node:path";
import { app, ipcMain } from "electron";
import { IPC_CHANNELS } from "../../src/shared/ipc";
import { getDesktopDatabase } from "../db/client";
import { DEFAULT_LIBRARY_ID } from "../db/folder-analysis-status";
import { getFolderGeoCoverage } from "../db/folder-geo-coverage";
import {
  analyzePathsWithLlmStreaming,
  llmResultToPathExtraction,
  type LlmPathResult,
} from "../path-extraction/llm-path-analyzer";
import { pathExtractionDebugLog } from "../path-extraction/path-extraction-debug";
import { syncFtsForMediaItem } from "../db/keyword-search";
import { resolveEventDate } from "../path-extraction/event-date-resolver";
import { resolveLocation } from "../path-extraction/location-resolver";
import { isCameraPrefixOnlyFilename } from "../path-extraction/title-extractor";
import { mergeMetadataV2 } from "@emk/media-metadata-core";
import { emitPathAnalysisProgress } from "./progress-emitters";
import { runningPathAnalysisJobs } from "./state";
import {
  collectFoldersRecursivelyWithProgress,
  collectImageEntriesForFoldersWithProgress,
  ensureCatalogForImagesWithProgress,
} from "./folder-utils";
import { acquirePowerSave, releasePowerSave } from "./power-save-manager";
import type { RunningPathAnalysisJob } from "./types";
import type {
  PathDateExtraction,
  PathLocationExtraction,
  SourcedLocation,
} from "../path-extraction/types";
import { getOllamaBaseUrlForModelResolve, resolveOllamaTextChatModel } from "../ollama-model-resolve";
import { readSettings } from "../storage";

/** Deduped, normalized paths (order preserved) for stable catalog + LLM batches. */
export function normalizePathList(imagePaths: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of imagePaths) {
    const n = path.normalize(p);
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

export function getUniqueParentFolders(paths: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const filePath of paths) {
    const folder = path.dirname(filePath);
    if (!seen.has(folder)) {
      seen.add(folder);
      out.push(folder);
    }
  }
  return out;
}

export function splitPathsForLlm(paths: string[]): {
  pathsForFileLlm: string[];
  skippedCameraPrefixPaths: string[];
} {
  const pathsForFileLlm: string[] = [];
  const skippedCameraPrefixPaths: string[] = [];
  for (const filePath of paths) {
    const baseName = path.basename(filePath);
    if (isCameraPrefixOnlyFilename(baseName)) {
      skippedCameraPrefixPaths.push(filePath);
      continue;
    }
    pathsForFileLlm.push(filePath);
  }
  return { pathsForFileLlm, skippedCameraPrefixPaths };
}

/** Opt-in via `EMK_DEBUG_PATH_EXTRACTION` (same as other path extraction debug). */
function debugPathAnalysis(message: string, details?: Record<string, unknown>): void {
  pathExtractionDebugLog(
    details != null
      ? `[path-analysis][debug] ${message} ${JSON.stringify(details)}`
      : `[path-analysis][debug] ${message}`,
  );
}

export function folderContextFromResult(result: LlmPathResult): FolderLlmContext {
  return {
    date: result.date
      ? {
          start: result.date.start,
          end: result.date.end,
          precision: result.date.precision,
          source: "llm_path",
        }
      : null,
    location: result.location
      ? {
          country: result.location.country,
          country_code: result.location.country_code,
          area: result.location.area,
          city: result.location.city,
          place_name: null,
          source: "llm_path",
        }
      : null,
  };
}

export function mergeResultWithFolderContext(
  result: LlmPathResult,
  context: FolderLlmContext | undefined,
): LlmPathResult {
  if (!context) {
    return result;
  }
  return {
    ...result,
    date:
      result.date ??
      (context.date
        ? {
            start: context.date.start,
            end: context.date.end,
            precision: context.date.precision,
          }
        : null),
    location:
      result.location ??
      (context.location
        ? {
            country: context.location.country ?? null,
            country_code: context.location.country_code ?? null,
            area: context.location.area ?? null,
            city: context.location.city ?? null,
          }
        : null),
  };
}

type MediaItemRowLite = {
  id: string;
  photo_taken_at: string | null;
  photo_taken_precision: string | null;
  file_created_at: string | null;
  ai_metadata: string | null;
};

type FolderLlmContext = {
  date: PathDateExtraction | null;
  location: PathLocationExtraction | null;
};

function lookupMediaItemForPath(
  db: ReturnType<typeof getDesktopDatabase>,
  libraryId: string,
  filePath: string,
): MediaItemRowLite | undefined {
  const normalized = path.normalize(filePath);
  const baseSql =
    `SELECT id, photo_taken_at, photo_taken_precision, file_created_at, ai_metadata
     FROM media_items
     WHERE library_id = ? AND deleted_at IS NULL AND`;

  const asRow = (row: unknown): MediaItemRowLite | undefined =>
    row as MediaItemRowLite | undefined;

  let row = asRow(
    db.prepare(`${baseSql} source_path = ? LIMIT 1`).get(libraryId, normalized),
  );
  if (row) {
    return row;
  }

  const slashVariant = normalized.includes("\\")
    ? normalized.replace(/\\/g, "/")
    : normalized.replace(/\//g, "\\");
  if (slashVariant !== normalized) {
    row = asRow(
      db.prepare(`${baseSql} source_path = ? LIMIT 1`).get(libraryId, slashVariant),
    );
  }
  if (row) {
    return row;
  }

  if (process.platform === "win32") {
    row = asRow(
      db
        .prepare(
          `${baseSql} lower(source_path) = lower(?) LIMIT 1`,
        )
        .get(libraryId, normalized),
    );
  }

  return row;
}

export function registerPathAnalysisHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.analyzeFolderPathMetadata,
    async (
      _event,
      request: { folderPath: string; recursive?: boolean; model?: string },
    ): Promise<{ jobId: string; total: number }> => {
      const folderPath = request.folderPath?.trim();
      if (!folderPath) {
        throw new Error("Folder path is required for path analysis");
      }
      const recursive = request.recursive === true;
      const folders = recursive
        ? await collectFoldersRecursivelyWithProgress(folderPath)
        : [folderPath];
      const imageEntries = await collectImageEntriesForFoldersWithProgress(folders);
      const paths = normalizePathList(imageEntries.map((e) => e.path));
      debugPathAnalysis("request prepared", {
        folderPath,
        recursive,
        folders: folders.length,
        imageEntries: imageEntries.length,
        uniquePaths: paths.length,
      });

      await ensureCatalogForImagesWithProgress(paths);
      debugPathAnalysis("catalog ensured", { folderPath, uniquePaths: paths.length });

      pathExtractionDebugLog(
        `[path-analysis] job prep: folders=${folders.length} imageEntries=${imageEntries.length} uniquePaths=${paths.length}`,
      );

      const userModel = request.model?.trim() || null;
      let primaryModelId: string | null = null;
      let fallbackModelId: string | null = null;
      try {
        const appSettings = await readSettings(app.getPath("userData"));
        primaryModelId = appSettings.pathExtraction.llmModelPrimary;
        fallbackModelId = appSettings.pathExtraction.llmModelFallback;
      } catch {
        // Use resolver defaults for primary/fallback ids.
      }
      const ollamaModel = await resolveOllamaTextChatModel({
        preferred: userModel,
        primaryModelId,
        fallbackModelId,
      });
      if (!ollamaModel) {
        throw new Error(
          `No suitable Ollama text model found at ${getOllamaBaseUrlForModelResolve()}. ` +
            `Pull the models set under Folder scanning, file metadata and Geo-location -> Detect location and dates from file paths using AI (LLM), ` +
            `or enter ids that match ollama list.`,
        );
      }
      pathExtractionDebugLog(
        `[path-analysis] using Ollama model "${ollamaModel}" (from /api/tags; same resolution as AI search query understanding)`,
      );
      debugPathAnalysis("model resolved", { folderPath, model: ollamaModel });

      const jobId = randomUUID();
      const job: RunningPathAnalysisJob = {
        cancelled: false,
        folderPath,
      };
      job.powerSaveToken = acquirePowerSave(`path-analysis:${folderPath}`);
      runningPathAnalysisJobs.set(jobId, job);
      debugPathAnalysis("job-started emit", { jobId, folderPath, total: paths.length });

      emitPathAnalysisProgress({
        type: "job-started",
        jobId,
        folderPath,
        total: paths.length,
      });

      const foldersForLlm = getUniqueParentFolders(paths);
      const { pathsForFileLlm, skippedCameraPrefixPaths } = splitPathsForLlm(paths);
      pathExtractionDebugLog(
        `[path-analysis] LLM inputs: folders=${foldersForLlm.length} filePaths=${pathsForFileLlm.length} skippedCameraPrefix=${skippedCameraPrefixPaths.length}`,
      );
      debugPathAnalysis("llm inputs split", {
        jobId,
        foldersForLlm: foldersForLlm.length,
        pathsForFileLlm: pathsForFileLlm.length,
        skippedCameraPrefixPaths: skippedCameraPrefixPaths.length,
      });

      void runPathAnalysisBackground(
        jobId,
        job,
        folderPath,
        paths,
        pathsForFileLlm,
        skippedCameraPrefixPaths,
        foldersForLlm,
        ollamaModel,
      );

      return { jobId, total: paths.length };
    },
  );

  ipcMain.handle(IPC_CHANNELS.cancelPathAnalysis, async (_event, jobId: string) => {
    const target = runningPathAnalysisJobs.get(jobId);
    if (target) {
      target.cancelled = true;
      if (target.powerSaveToken) {
        releasePowerSave(target.powerSaveToken);
        target.powerSaveToken = undefined;
      }
    }
    return target != null;
  });
}

async function runPathAnalysisBackground(
  jobId: string,
  job: RunningPathAnalysisJob,
  folderPath: string,
  allPaths: string[],
  pathsForFileLlm: string[],
  skippedCameraPrefixPaths: string[],
  foldersForLlm: string[],
  model: string,
): Promise<void> {
  let processed = 0;
  let failed = 0;
  const total = allPaths.length;
  const failureSamples: Array<{ path: string; reason: string }> = [];
  const pushFailureSample = (filePath: string, reason: string): void => {
    if (failureSamples.length < 8) {
      failureSamples.push({ path: filePath, reason });
    }
  };

  try {
    const folderContextByFolder = new Map<string, FolderLlmContext>();
    debugPathAnalysis("background started", {
      jobId,
      folderPath,
      total,
      foldersForLlm: foldersForLlm.length,
      pathsForFileLlm: pathsForFileLlm.length,
      skippedCameraPrefixPaths: skippedCameraPrefixPaths.length,
      model,
    });
    if (foldersForLlm.length > 0) {
      debugPathAnalysis("folder-context llm phase started", { jobId, total: foldersForLlm.length });
      await analyzePathsWithLlmStreaming(
        foldersForLlm,
        model,
        async ({ batchPaths, batchResults, cumulativeProcessed, total: folderTotal }) => {
          const n = Math.min(batchPaths.length, batchResults.length);
          for (let i = 0; i < n; i++) {
            folderContextByFolder.set(batchPaths[i]!, folderContextFromResult(batchResults[i]!));
          }
          const locationResults = batchResults.filter((result) => result.location != null).length;
          debugPathAnalysis("folder-context batch completed", {
            jobId,
            batchPaths: batchPaths.length,
            batchResults: batchResults.length,
            locationResults,
            cumulativeProcessed,
            total: folderTotal,
            storedContexts: folderContextByFolder.size,
            cancelled: job.cancelled,
          });
          return !job.cancelled;
        },
      );
      debugPathAnalysis("folder-context llm phase completed", {
        jobId,
        storedContexts: folderContextByFolder.size,
      });
    }
    if (job.cancelled) {
      debugPathAnalysis("background stopped after folder context because job is cancelled", { jobId });
      return;
    }

    if (pathsForFileLlm.length === 0) {
      debugPathAnalysis("file llm phase skipped because no file paths require LLM", { jobId });
    } else {
      debugPathAnalysis("file llm phase started", { jobId, total: pathsForFileLlm.length });
    }
    await analyzePathsWithLlmStreaming(pathsForFileLlm, model, async ({ batchPaths, batchResults, cumulativeProcessed }) => {
      if (job.cancelled) {
        debugPathAnalysis("file llm batch ignored because job is cancelled", { jobId });
        return false;
      }
      if (batchPaths.length !== batchResults.length) {
        console.warn(
          `[path-analysis][batch] path/result count mismatch: paths=${batchPaths.length} results=${batchResults.length} (job ${jobId}) — using min(); some files may be skipped`,
        );
      }
      const n = Math.min(batchPaths.length, batchResults.length);
      const locationResults = batchResults.filter((result) => result.location != null).length;
      const dateResults = batchResults.filter((result) => result.date != null).length;
      debugPathAnalysis("file llm batch received", {
        jobId,
        batchPaths: batchPaths.length,
        batchResults: batchResults.length,
        locationResults,
        dateResults,
        cumulativeProcessed,
        processedBeforePersist: processed,
        failedBeforePersist: failed,
      });
      for (let i = 0; i < n; i++) {
        if (job.cancelled) {
          debugPathAnalysis("persist loop stopped because job is cancelled", { jobId });
          return false;
        }
        const filePath = batchPaths[i];
        try {
          const mergedResult = mergeResultWithFolderContext(
            batchResults[i]!,
            folderContextByFolder.get(path.dirname(filePath)),
          );
          persistLlmPathResult(filePath, mergedResult, model);
          processed++;
          pathExtractionDebugLog(`[path-analysis][persist] ok ${filePath}`);
        } catch (err) {
          failed++;
          const message = err instanceof Error ? err.message : String(err);
          const stack = err instanceof Error ? err.stack : undefined;
          pushFailureSample(filePath, message);
          console.error(`[path-analysis][persist] FAILED: ${filePath}`);
          console.error(`[path-analysis][persist] reason: ${message}`);
          if (stack) {
            console.error(stack);
          }
        }
      }
      if (batchPaths.length > n) {
        const skipped = batchPaths.length - n;
        failed += skipped;
        console.warn(
          `[path-analysis][batch] ${skipped} path(s) had no paired LLM result (job ${jobId}); marked failed`,
        );
        for (let j = n; j < batchPaths.length; j++) {
          const filePath = batchPaths[j];
          pushFailureSample(filePath, "no_paired_llm_result_in_batch");
          console.error(`[path-analysis][persist] FAILED: ${filePath} (no paired LLM result)`);
        }
      }
      emitPathAnalysisProgress({
        type: "progress",
        jobId,
        processed,
        total,
      });
      debugPathAnalysis("progress emitted after file batch", { jobId, processed, failed, total });
      return !job.cancelled;
    });

    if (skippedCameraPrefixPaths.length > 0) {
      debugPathAnalysis("camera-prefix fallback phase started", {
        jobId,
        skippedCameraPrefixPaths: skippedCameraPrefixPaths.length,
      });
    }
    for (const filePath of skippedCameraPrefixPaths) {
      if (job.cancelled) {
        debugPathAnalysis("camera-prefix fallback stopped because job is cancelled", { jobId });
        return;
      }
      const folderContext = folderContextByFolder.get(path.dirname(filePath));
      const fallbackResult: LlmPathResult = {
        index: 0,
        date: folderContext?.date
          ? {
              start: folderContext.date.start,
              end: folderContext.date.end,
              precision: folderContext.date.precision,
            }
          : null,
        location: folderContext?.location
          ? {
              country: folderContext.location.country ?? null,
              country_code: folderContext.location.country_code ?? null,
              area: folderContext.location.area ?? null,
              city: folderContext.location.city ?? null,
            }
          : null,
        display_title: null,
      };
      try {
        persistLlmPathResult(filePath, fallbackResult, model);
        processed++;
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        pushFailureSample(filePath, message);
      }
      emitPathAnalysisProgress({
        type: "progress",
        jobId,
        processed,
        total,
      });
      debugPathAnalysis("progress emitted after camera-prefix fallback", { jobId, processed, failed, total });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[path-analysis] LLM pipeline failed (job ${jobId}): ${msg}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    const prevFailed = failed;
    failed = Math.max(failed, total - processed);
    console.error(
      `[path-analysis] after LLM error: processed=${processed} failedBefore=${prevFailed} failedTotal=${failed} (job ${jobId})`,
    );
    debugPathAnalysis("background caught error", { jobId, processed, failed, total, error: msg });
  } finally {
    if (job.powerSaveToken) {
      releasePowerSave(job.powerSaveToken);
      job.powerSaveToken = undefined;
    }

    if (job.cancelled) {
      debugPathAnalysis("job-cancelled emit", { jobId, folderPath, processed, failed, total });
      emitPathAnalysisProgress({
        type: "job-cancelled",
        jobId,
        folderPath,
      });
    } else {
      pathExtractionDebugLog(
        `[path-analysis][job-completed] jobId=${jobId} folder=${folderPath} total=${total} processed=${processed} failed=${failed}`,
      );
      if (failureSamples.length > 0) {
        pathExtractionDebugLog(
          `[path-analysis][failure-samples] copy-paste below:\n${JSON.stringify(failureSamples, null, 2)}`,
        );
        debugPathAnalysis("failure samples", { jobId, failureSamples });
      }
      const geoCoverage = getFolderGeoCoverage({ folderPath, recursive: true });
      debugPathAnalysis("geo coverage after completion", {
        jobId,
        imagesWithGps: geoCoverage.images.withGpsCount,
        imagesWithoutGps: geoCoverage.images.withoutGpsCount,
        pathLlmDone: geoCoverage.pathLlmLocationDetails?.doneCount ?? 0,
        pathLlmTotalImages: geoCoverage.pathLlmLocationDetails?.totalImages ?? 0,
      });
      debugPathAnalysis("job-completed emit", { jobId, folderPath, total, processed, failed });
      emitPathAnalysisProgress({
        type: "job-completed",
        jobId,
        folderPath,
        total,
        processed,
        failed,
      });
    }
    runningPathAnalysisJobs.delete(jobId);
  }
}

export function persistLlmPathResult(filePath: string, result: LlmPathResult, model: string): void {
  const db = getDesktopDatabase();
  const libraryId = DEFAULT_LIBRARY_ID;
  const now = new Date().toISOString();

  const row = lookupMediaItemForPath(db, libraryId, filePath);
  if (!row) {
    throw new Error(
      `no_catalog_row: no media_items row for path after ensureCatalog (path=${filePath} normalized=${path.normalize(filePath)})`,
    );
  }

  const pathExtraction = llmResultToPathExtraction(result, model, filePath);

  // Re-resolve event date with LLM data if present
  let eventDateUpdate: {
    start: string | null;
    end: string | null;
    precision: string | null;
    source: string | null;
  } = { start: null, end: null, precision: null, source: null };

  if (pathExtraction.date) {
    const resolved = resolveEventDate(
      {
        photoTakenAt: row.photo_taken_at,
        photoTakenPrecision: row.photo_taken_precision as "year" | "month" | "day" | "instant" | null,
      },
      pathExtraction.date,
      { fileCreatedAt: row.file_created_at },
    );
    if (resolved) {
      eventDateUpdate = {
        start: resolved.start,
        end: resolved.end,
        precision: resolved.precision,
        source: resolved.source,
      };
    }
  }

  // Merge location into locations_by_source and resolve
  let locationUpdate: {
    country: string | null;
    city: string | null;
    area: string | null;
    place: string | null;
    source: string | null;
  } = { country: null, city: null, area: null, place: null, source: null };

  let current: Record<string, unknown> | null = null;
  if (row.ai_metadata) {
    try {
      current = JSON.parse(row.ai_metadata) as Record<string, unknown>;
    } catch {
      current = null;
    }
  }

  if (pathExtraction.location) {
    const existingSources = Array.isArray(
      (current as { locations_by_source?: unknown } | null)?.locations_by_source,
    )
      ? ((current as { locations_by_source: SourcedLocation[] }).locations_by_source)
      : [];

    const llmLoc: SourcedLocation = {
      country: pathExtraction.location.country ?? null,
      country_code: pathExtraction.location.country_code ?? null,
      area: pathExtraction.location.area ?? null,
      city: pathExtraction.location.city ?? null,
      place_name: pathExtraction.location.place_name ?? null,
      source: "path_llm",
    };

    const merged = [
      ...existingSources.filter((s) => s.source !== "path_llm"),
      llmLoc,
    ];

    const resolved = resolveLocation(merged);
    if (resolved) {
      locationUpdate = {
        country: resolved.country,
        city: resolved.city,
        area: resolved.area,
        place: resolved.place,
        source: resolved.source,
      };
    }

    let metaMerge: ReturnType<typeof mergeMetadataV2>;
    try {
      metaMerge = mergeMetadataV2(current, {
        schema_version: "2.0",
        path_extraction: pathExtraction,
        locations_by_source: merged,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`merge_metadata_failed: ${msg}`);
    }

    let aiJson: string;
    try {
      aiJson = JSON.stringify(metaMerge);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`ai_metadata_stringify_failed: ${msg}`);
    }

    const info = db
      .prepare(
      `UPDATE media_items SET
         event_date_start = COALESCE(?, event_date_start),
         event_date_end = COALESCE(?, event_date_end),
         event_date_precision = COALESCE(?, event_date_precision),
         event_date_source = COALESCE(?, event_date_source),
         country = COALESCE(?, country),
         city = COALESCE(?, city),
         location_area = COALESCE(?, location_area),
         location_place = COALESCE(?, location_place),
         location_source = COALESCE(?, location_source),
         display_title = COALESCE(?, display_title),
         path_llm_extraction_at = ?,
         ai_metadata = ?,
         updated_at = ?
       WHERE id = ? AND library_id = ?`,
      )
      .run(
      eventDateUpdate.start,
      eventDateUpdate.end,
      eventDateUpdate.precision,
      eventDateUpdate.source,
      locationUpdate.country,
      locationUpdate.city,
      locationUpdate.area,
      locationUpdate.place,
      locationUpdate.source,
      pathExtraction.display_title ?? null,
      now,
      aiJson,
      now,
      row.id,
      libraryId,
    );
    if (info.changes === 0) {
      throw new Error(`update_affected_0_rows: id=${row.id}`);
    }
    try {
      syncFtsForMediaItem(row.id, libraryId);
    } catch (ftsErr) {
      const msg = ftsErr instanceof Error ? ftsErr.message : String(ftsErr);
      console.warn(`[path-analysis][fts] sync skipped (non-fatal) id=${row.id} path=${filePath}: ${msg}`);
    }
  } else {
    // No location from LLM, just update date and metadata
    let metaMerge: ReturnType<typeof mergeMetadataV2>;
    try {
      metaMerge = mergeMetadataV2(current, {
        schema_version: "2.0",
        path_extraction: pathExtraction,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`merge_metadata_failed: ${msg}`);
    }

    let aiJson: string;
    try {
      aiJson = JSON.stringify(metaMerge);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`ai_metadata_stringify_failed: ${msg}`);
    }

    const info = db
      .prepare(
      `UPDATE media_items SET
         event_date_start = COALESCE(?, event_date_start),
         event_date_end = COALESCE(?, event_date_end),
         event_date_precision = COALESCE(?, event_date_precision),
         event_date_source = COALESCE(?, event_date_source),
         display_title = COALESCE(?, display_title),
         path_llm_extraction_at = ?,
         ai_metadata = ?,
         updated_at = ?
       WHERE id = ? AND library_id = ?`,
      )
      .run(
      eventDateUpdate.start,
      eventDateUpdate.end,
      eventDateUpdate.precision,
      eventDateUpdate.source,
      pathExtraction.display_title ?? null,
      now,
      aiJson,
      now,
      row.id,
      libraryId,
    );
    if (info.changes === 0) {
      throw new Error(`update_affected_0_rows: id=${row.id}`);
    }
    try {
      syncFtsForMediaItem(row.id, libraryId);
    } catch (ftsErr) {
      const msg = ftsErr instanceof Error ? ftsErr.message : String(ftsErr);
      console.warn(`[path-analysis][fts] sync skipped (non-fatal) id=${row.id} path=${filePath}: ${msg}`);
    }
  }
}

import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { BrowserWindow, ipcMain } from "electron";
import {
  IPC_CHANNELS,
  DEFAULT_AI_IMAGE_SEARCH_SETTINGS,
  type IndexFolderSemanticRequest,
  type IndexFolderSemanticResult,
  type SemanticIndexItemState,
} from "../../src/shared/ipc";
import { listFolderImages } from "../fs-media";
import {
  // describeImageForEmbedding,  // VLM caption fallback — kept for future use
  // embedText,                  // Ollama text embedding — replaced by ONNX embedTextDirect
  MULTIMODAL_EMBED_MODEL,
} from "../semantic-embeddings";
import {
  embedImageDirect,
  embedTextDirect,
  embedTextForDocument,
  probeTextEmbeddingReady,
  probeVisionEmbeddingReady,
  warmupVisionPipeline,
} from "../nomic-vision-embedder";
import { buildCaptionText } from "../db/media-analysis";
import {
  clearVectorCache,
  clearDescriptionVectorCache,
  getCachedDescriptionVector,
  getFailedImageEmbeddingPaths,
  getCachedImageVector,
  ensureMediaItemForPath,
  getIndexedImageMediaIdsByPaths,
  getMediaItemContextByPath,
  searchByVector,
  searchByDescriptionVector,
  type SemanticFilters,
  type SemanticSearchRow,
} from "../db/semantic-search";
import { searchByKeyword, type KeywordSearchFilters } from "../db/keyword-search";
import { fuseWithRRF, toRankedList } from "../db/search-fusion";
import { analyzeSearchQuery, type QueryAnalysis } from "../query-understanding";
import { reRankByKeywordCoverage, type ReRankedRow } from "../db/keyword-reranker";
import { getVectorBackendStatus, getDesktopDatabase } from "../db/client";
import { appendSyncOperation } from "../db/sync-log";
import { getAiDescription, getAiTitle } from "@emk/media-metadata-core";
import { markFolderSemanticIndexed, setFolderAnalysisInProgress } from "../db/folder-analysis-status";
import { vectorStore, semanticIndexJobRef, semanticEmbeddingStatusRef } from "./state";
import type { RunningSemanticIndexJob } from "./types";
import { collectFoldersRecursively, collectImageEntriesForFolders, ensureCatalogForImages, ensureMetadataForImage } from "./folder-utils";
import { emitSemanticIndexProgress } from "./progress-emitters";
import { acquirePowerSave, releasePowerSave } from "./power-save-manager";
import { isVerboseElectronLogsEnabled } from "../verbose-electron-logs";
import { getFaceRecognitionSimilarityThreshold } from "../face-recognition-threshold";
import type { SemanticSearchSignalMode } from "@emk/media-store";
import { readSettings } from "../storage";
import { app } from "electron";
import { runWrongImageRotationPrecheck } from "../orientation-preprocess";

const consoleLog = console.log.bind(console);

function logVerbose(...args: Parameters<typeof console.log>): void {
  if (!isVerboseElectronLogsEnabled()) return;
  consoleLog(...args);
}

function formatKeywordRerankHitScores(r: ReRankedRow): string {
  const scores = r.keywordHitScores;
  if (!scores.length) return "(—)";
  return `(${scores.map((s) => s.toFixed(4)).join("/")})`;
}

export function registerSemanticSearchHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.indexFolderSemanticEmbeddings,
    async (
      event,
      request: IndexFolderSemanticRequest,
    ): Promise<IndexFolderSemanticResult> => {
      if (semanticIndexJobRef.current) {
        throw new Error("Semantic indexing is already running");
      }
      const folderPath = request.folderPath?.trim();
      if (!folderPath) {
        throw new Error("Folder path is required for semantic indexing");
      }

      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      if (!browserWindow) {
        throw new Error("No browser window found for semantic indexing");
      }

      const folders = request.recursive
        ? await collectFoldersRecursively(folderPath)
        : [folderPath];
      const allImages = await collectImageEntriesForFolders(folders);

      ensureCatalogForImages(allImages.map((img) => img.path));

      const mode = request.mode === "all" ? "all" : "missing";
      const skipPreviouslyFailed = request.skipPreviouslyFailed === true;
      const existing = getIndexedImageMediaIdsByPaths(allImages.map((img) => img.path));
      const previouslyFailed = getFailedImageEmbeddingPaths(allImages.map((img) => img.path));
      const selectedBase =
        mode === "missing"
          ? allImages.filter((img) => !existing.has(img.path))
          : allImages;
      const selectedFresh = selectedBase.filter((img) => !previouslyFailed.has(img.path));
      const selectedFailed = selectedBase.filter((img) => previouslyFailed.has(img.path));
      const selected = skipPreviouslyFailed
        ? selectedFresh
        : [...selectedFresh, ...selectedFailed];

      const items: SemanticIndexItemState[] = selected.map((img) => ({
        path: img.path,
        name: img.name,
        status: "pending" as const,
      }));

      const jobId = randomUUID();
      const job: RunningSemanticIndexJob = {
        jobId,
        folderPath,
        cancelled: false,
        finalized: false,
        controllers: new Set<AbortController>(),
        browserWindow,
        itemsByPath: new Map(
          selected.map((img) => [
            img.path,
            { name: img.name, folderPath: img.folderPath, status: "pending" as const },
          ]),
        ),
        completed: 0,
        failed: 0,
        cancelledCount: 0,
        totalElapsedSeconds: 0,
      };
      job.powerSaveToken = acquirePowerSave(`semantic-index:${folderPath}`);
      semanticIndexJobRef.current = job;

      emitSemanticIndexProgress(browserWindow, {
        type: "job-started",
        jobId,
        folderPath,
        total: selected.length,
        items,
      });

      setFolderAnalysisInProgress(folderPath, "semantic", true);

      const appSettings = await readSettings(app.getPath("userData"));
      void runSemanticIndexJob(job, selected, appSettings).finally(() => {
        if (job.powerSaveToken) {
          releasePowerSave(job.powerSaveToken);
          job.powerSaveToken = undefined;
        }
        semanticIndexJobRef.current = null;
      });

      return { jobId, total: selected.length };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.cancelSemanticEmbeddingIndex,
    async (_event, _jobId?: string): Promise<boolean> => {
      const job = semanticIndexJobRef.current;
      if (!job) {
        return false;
      }
      job.cancelled = true;
      job.controllers.forEach((controller) => controller.abort());
      if (!job.finalized) {
        finalizeCancelledSemanticJob(job);
      }
      return true;
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.getSemanticEmbeddingStatus,
    async (): Promise<{
      model: string;
      textEmbeddingReady: boolean;
      /** Nomic ONNX text pipeline (used by embedTextDirect / semantic search). */
      onnxTextEmbeddingReady: boolean;
      visionModelReady: boolean;
      visionOnnxReady: boolean;
      lastProbeError: string | null;
      vectorBackend: "classic" | "sqlite-vec";
      vectorBackendError: string | null;
      indexingInProgress: boolean;
      currentJobId: string | null;
      currentFolderPath: string | null;
    }> => {
      const vectorBackend = getVectorBackendStatus();
      const visionOnnxReady = await probeVisionEmbeddingReady();
      const onnxTextEmbeddingReady = await probeTextEmbeddingReady();
      return {
        ...semanticEmbeddingStatusRef.current,
        visionOnnxReady,
        onnxTextEmbeddingReady,
        vectorBackend: vectorBackend.activeMode,
        vectorBackendError: vectorBackend.lastError,
        indexingInProgress: Boolean(semanticIndexJobRef.current),
        currentJobId: semanticIndexJobRef.current?.jobId ?? null,
        currentFolderPath: semanticIndexJobRef.current?.folderPath ?? null,
      };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.semanticSearchPhotos,
    async (
      _event,
      request: {
        query: string;
        limit?: number;
        folderPath?: string;
        recursive?: boolean;
        personTagIds?: string[];
        includeUnconfirmedFaces?: boolean;
        eventDateStart?: string;
        eventDateEnd?: string;
        locationQuery?: string;
        advancedSearch?: boolean;
        vlmSimilarityThreshold?: number;
        descriptionSimilarityThreshold?: number;
        keywordMatchReranking?: boolean;
        keywordMatchThresholdVlm?: number;
        keywordMatchThresholdDescription?: number;
        signalMode?: SemanticSearchSignalMode;
      },
    ) => {
      const query = request.query?.trim();
      if (!query) {
        return { results: [] };
      }

      const searchT0 = Date.now();
      const signalMode: SemanticSearchSignalMode = request.signalMode ?? "hybrid";
      const keywordMatchReranking = request.keywordMatchReranking === true;
      const keywordMatchThresholdVlm =
        typeof request.keywordMatchThresholdVlm === "number" &&
        Number.isFinite(request.keywordMatchThresholdVlm)
          ? Math.max(0, Math.min(1, request.keywordMatchThresholdVlm))
          : DEFAULT_AI_IMAGE_SEARCH_SETTINGS.keywordMatchThresholdVlm;
      const keywordMatchThresholdDescription =
        typeof request.keywordMatchThresholdDescription === "number" &&
        Number.isFinite(request.keywordMatchThresholdDescription)
          ? Math.max(0, Math.min(1, request.keywordMatchThresholdDescription))
          : DEFAULT_AI_IMAGE_SEARCH_SETTINGS.keywordMatchThresholdDescription;
      logVerbose(
        `[semantic-search][main][${new Date().toISOString()}] search START query="${query}" advanced=${!!request.advancedSearch} signalMode=${signalMode} kwRerank=${keywordMatchReranking} kwVlmTh=${keywordMatchThresholdVlm} kwDescTh=${keywordMatchThresholdDescription}`,
      );

      // ── Advanced search: LLM query preprocessing ─────────────
      let queryAnalysis: QueryAnalysis | undefined;
      let analysisModel: string | undefined;
      const searchQuery = query;
      let embeddingQuery = query;

      if (request.advancedSearch) {
        const result = await analyzeSearchQuery(query);
        if (result) {
          queryAnalysis = result.analysis;
          analysisModel = result.model;
          // Always embed the English query when LLM analysis succeeds — models often
          // omit `translated: true` while still returning english_query; Cyrillic/raw
          // text in Nomic search_query: space hurts retrieval.
          const eq = queryAnalysis.englishQuery?.trim();
          if (eq.length > 0) {
            embeddingQuery = eq;
          }
          logVerbose(
            `[semantic-search][main][+${Date.now() - searchT0}ms] query analysis done (model: ${analysisModel})`,
          );
          logVerbose(
            "[semantic-search][main][advanced] LLM structured (copy-paste):",
            JSON.stringify(
              {
                original_language: queryAnalysis.originalLanguage,
                translated: queryAnalysis.translated,
                english_query: queryAnalysis.englishQuery,
                keywords: queryAnalysis.keywords,
              },
              null,
              2,
            ),
          );
        } else {
          logVerbose(
            `[semantic-search][main][+${Date.now() - searchT0}ms] query analysis failed or unavailable, using raw query for embedding`,
          );
        }
      }

      if (request.advancedSearch) {
        logVerbose(
          `[semantic-search][main][advanced] text passed to embedTextDirect: ${JSON.stringify(embeddingQuery)} (user query was: ${JSON.stringify(query)})`,
        );
      }
      const queryVector = await embedTextDirect(embeddingQuery);
      logVerbose(`[semantic-search][main][+${Date.now() - searchT0}ms] embedTextDirect done`);

      const hasPersonFilter = request.personTagIds && request.personTagIds.length > 0;
      const wantUnconfirmed = hasPersonFilter && request.includeUnconfirmedFaces === true;

      if (wantUnconfirmed && hasPersonFilter) {
        const { ensureSuggestionsExist } = await import("../db/person-suggestions");
        const suggestionThreshold = await getFaceRecognitionSimilarityThreshold();
        const refreshed = ensureSuggestionsExist(request.personTagIds!, {
          threshold: suggestionThreshold,
        });
        if (refreshed > 0) {
          logVerbose(`[semantic-search][main] lazy-populated ${refreshed} person suggestion(s)`);
        }
      }

      const eventDateStart =
        typeof request.eventDateStart === "string" && request.eventDateStart.trim()
          ? request.eventDateStart.trim()
          : undefined;
      const eventDateEnd =
        typeof request.eventDateEnd === "string" && request.eventDateEnd.trim()
          ? request.eventDateEnd.trim()
          : undefined;
      const locationQuery =
        typeof request.locationQuery === "string" && request.locationQuery.trim()
          ? request.locationQuery.trim()
          : undefined;

      const filters: SemanticFilters = {
        folderPath: request.folderPath,
        recursive: request.recursive,
        personTagIds: hasPersonFilter ? request.personTagIds : undefined,
        includeUnconfirmedFaces: wantUnconfirmed,
        eventDateStart,
        eventDateEnd,
        locationQuery,
      };
      const kwFilters: KeywordSearchFilters = {
        folderPath: request.folderPath,
        recursive: request.recursive,
        personTagIds: hasPersonFilter ? request.personTagIds : undefined,
        includeUnconfirmedFaces: wantUnconfirmed,
        eventDateStart,
        eventDateEnd,
        locationQuery,
      };
      logVerbose(`[semantic-search][main] filters: ${JSON.stringify({ folderPath: filters.folderPath, recursive: filters.recursive, personTagIds: filters.personTagIds, includeUnconfirmedFaces: filters.includeUnconfirmedFaces })}`);
      const effectiveLimit = Math.max(1, request.limit ?? 100);
      const candidateCount = Math.max(effectiveLimit, 100);

      // Run vector, keyword, and description vector searches in parallel
      const [vectorRows, keywordRows, descriptionRows] = await Promise.all([
        searchByVector(queryVector, filters, candidateCount),
        Promise.resolve(searchByKeyword(searchQuery, kwFilters, candidateCount)),
        searchByDescriptionVector(queryVector, filters, candidateCount),
      ]);
      logVerbose(
        `[semantic-search][main][+${Date.now() - searchT0}ms] vision=${vectorRows.length} keyword=${keywordRows.length} description=${descriptionRows.length}`,
      );

      const vlmScoreById = new Map(vectorRows.map((r) => [r.mediaItemId, r.score]));
      const descriptionScoreById = new Map(descriptionRows.map((r) => [r.mediaItemId, r.score]));
      const keywordScoreById = new Map(
        keywordRows.map((r) => [r.mediaItemId, r.bm25Score]),
      );

      // Build metadata lookup from all result sets
      const metadataMap = new Map<string, SemanticSearchRow>();
      for (const row of vectorRows) {
        metadataMap.set(row.mediaItemId, row);
      }
      for (const row of descriptionRows) {
        if (!metadataMap.has(row.mediaItemId)) {
          metadataMap.set(row.mediaItemId, row);
        }
      }

      // RRF: one or both of vision (VLM) + AI description ranks (keyword run kept for summary / diagnostics).
      const rankedLists =
        signalMode === "hybrid"
          ? [toRankedList(vectorRows), toRankedList(descriptionRows)]
          : signalMode === "vlm-only"
            ? [toRankedList(vectorRows)]
            : [toRankedList(descriptionRows)];
      const fused = fuseWithRRF(rankedLists, 60, effectiveLimit);

      let rows: SemanticSearchRow[] = [];
      for (const f of fused) {
        const meta = metadataMap.get(f.mediaItemId);
        if (meta) {
          rows.push({ ...meta, score: f.rrfScore });
        }
      }

      // ── Advanced search: keyword re-ranking ──────────────────
      const canKeywordRerank =
        Boolean(request.advancedSearch) &&
        keywordMatchReranking &&
        Boolean(queryAnalysis?.keywords?.length) &&
        (keywordMatchThresholdVlm > 0 || keywordMatchThresholdDescription > 0);

      if (request.advancedSearch) {
        if (!queryAnalysis) {
          logVerbose(
            "[semantic-search][main][advanced] keyword re-rank skipped: no queryAnalysis (LLM failed or Ollama unavailable)",
          );
        } else if (!queryAnalysis.keywords.length) {
          logVerbose(
            "[semantic-search][main][advanced] keyword re-rank skipped: keywords array empty after LLM parse",
          );
        } else if (!keywordMatchReranking) {
          logVerbose(
            "[semantic-search][main][advanced] keyword re-rank skipped: keyword match reranking is off in settings",
          );
        } else if (keywordMatchThresholdVlm <= 0 && keywordMatchThresholdDescription <= 0) {
          logVerbose(
            "[semantic-search][main][advanced] keyword re-rank skipped: both keyword match thresholds are 0",
          );
        }
      }
      if (canKeywordRerank && queryAnalysis?.keywords?.length) {
        const beforeSnapshot = rows.map((r, i) => ({
          rank: i + 1,
          name: r.name,
          score: r.score,
          mediaItemId: r.mediaItemId,
        }));
        logVerbose(
          `[semantic-search][main][advanced] ===== RRF order BEFORE keyword re-rank (top ${Math.min(beforeSnapshot.length, 25)}, copy-paste) =====`,
        );
        for (const row of beforeSnapshot.slice(0, 25)) {
          logVerbose(
            `  ${row.rank}. score=${row.score.toFixed(6)} ${row.name}`,
          );
        }

        const reRanked = await reRankByKeywordCoverage(
          rows,
          queryAnalysis.keywords,
          getCachedImageVector,
          getCachedDescriptionVector,
          {
            vlmThreshold: keywordMatchThresholdVlm,
            descriptionThreshold: keywordMatchThresholdDescription,
            hitSignalMode: signalMode,
          },
        );
        logVerbose(
          `[semantic-search][main][+${Date.now() - searchT0}ms] keyword re-ranking done (${queryAnalysis.keywords.length} keywords, ${reRanked.length} rows, kwVlmTh=${keywordMatchThresholdVlm} kwDescTh=${keywordMatchThresholdDescription})`,
        );

        logVerbose(
          "[semantic-search][main][advanced] ===== FULL order AFTER keyword re-rank (copy-paste) =====",
        );
        for (let i = 0; i < reRanked.length; i++) {
          const r = reRanked[i];
          const hitPart = formatKeywordRerankHitScores(r);
          logVerbose(
            `  ${i + 1}. score=${r.score.toFixed(6)} coverage=${r.keywordCoverage.toFixed(4)} hits=${r.keywordHits}/${queryAnalysis.keywords.length} ${hitPart} ${r.name}`,
          );
        }

        for (let i = 0; i < Math.min(reRanked.length, 10); i++) {
          const r = reRanked[i];
          const hitPart = formatKeywordRerankHitScores(r);
          logVerbose(
            `${SEMANTIC_SEARCH_SCORE_LOG_INDENT}${i + 1}. ${r.name} — coverage=${r.keywordCoverage.toFixed(3)} hits=${r.keywordHits}/${queryAnalysis.keywords.length} ${hitPart}`,
          );
        }
        rows = reRanked;
      }

      const rrfLabel =
        signalMode === "hybrid"
          ? "VLM + description"
          : signalMode === "vlm-only"
            ? "VLM only"
            : "description only";
      logVerbose(
        `[semantic-search][main][+${Date.now() - searchT0}ms] returning ${rows.length} results (RRF: ${rrfLabel}${
          canKeywordRerank ? " + keyword rerank" : ""
        })`,
      );
      logVerbose("[semantic-search][main] query:", searchQuery);
      logVerbose(
        "[semantic-search][main] summary:",
        JSON.stringify({
          vectorCandidates: vectorRows.length,
          keywordCandidates: keywordRows.length,
          descriptionCandidates: descriptionRows.length,
          returned: rows.length,
        }),
      );

      logSemanticSearchTopScoreBreakdown(rows, vlmScoreById, descriptionScoreById, keywordScoreById, 10);

      if (wantUnconfirmed && hasPersonFilter) {
        const personTagIds = request.personTagIds!;
        const annotation = annotateConfirmedVsUnconfirmed(rows, personTagIds);
        logVerbose(
          `[semantic-search][main] --- IMAGES WITH ASSIGNED FACE TAGS (${annotation.confirmed.length}) ---`,
        );
        for (const entry of annotation.confirmed) {
          logVerbose(`  ${entry.score.toFixed(6)} - ${entry.name}`);
        }
        logVerbose(
          `[semantic-search][main] --- IMAGES WITH SIMILAR FACES (${annotation.unconfirmed.length}) ---`,
        );
        for (const entry of annotation.unconfirmed) {
          logVerbose(`  ${entry.score.toFixed(6)} - ${entry.name}`);
        }
      }

      return {
        results: rows.map((row) => ({
          ...row,
          url: pathToFileURL(row.path).toString(),
          vlmSimilarity: vlmScoreById.get(row.mediaItemId),
          descriptionSimilarity: descriptionScoreById.get(row.mediaItemId),
        })),
        queryAnalysis,
      };
    },
  );

  // TEMPORARY: description embedding backfill — remove after migration
  ipcMain.handle(
    IPC_CHANNELS.indexDescriptionEmbeddings,
    async (
      _event,
      request: { folderPath: string; recursive: boolean },
    ): Promise<{ jobId: string }> => {
      const jobId = randomUUID();
      void runDescEmbedBackfill(jobId, request.folderPath, request.recursive);
      return { jobId };
    },
  );

  // TEMPORARY: description embedding backfill — remove after migration
  ipcMain.handle(
    IPC_CHANNELS.cancelDescEmbedBackfill,
    async (_event, jobId: string): Promise<boolean> => {
      if (descEmbedBackfillAbort && descEmbedBackfillJobId === jobId) {
        descEmbedBackfillAbort.abort();
        return true;
      }
      return false;
    },
  );
}

// TEMPORARY: description embedding backfill state — remove after migration
let descEmbedBackfillAbort: AbortController | null = null;
let descEmbedBackfillJobId: string | null = null;

function sendDescEmbedProgress(event: import("../../src/shared/ipc").DescEmbedBackfillProgressEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC_CHANNELS.descEmbedBackfillProgress, event);
  }
}

// TEMPORARY: description embedding backfill — remove after migration
async function runDescEmbedBackfill(
  jobId: string,
  folderPath: string,
  recursive: boolean,
  libraryId = "local-default",
): Promise<void> {
  const abort = new AbortController();
  descEmbedBackfillAbort = abort;
  descEmbedBackfillJobId = jobId;

  try {
    const db = getDesktopDatabase();
    const sep = folderPath.includes("/") ? "/" : "\\";
    const folderPrefix = folderPath.endsWith(sep) ? folderPath : folderPath + sep;
    const escapedPrefix = folderPrefix.replace(/[%_~]/g, "~$&") + "%";

    const folderFilter = recursive
      ? `AND mi.source_path LIKE ? ESCAPE '~'`
      : `AND mi.source_path LIKE ? ESCAPE '~' AND instr(substr(mi.source_path, length(?) + 1), ?) = 0`;

    const folderParams = recursive
      ? [escapedPrefix]
      : [escapedPrefix, folderPrefix, sep];

    const rows = db.prepare(
      `SELECT mi.id, mi.ai_metadata
       FROM media_items mi
       WHERE mi.library_id = ?
         AND mi.ai_metadata IS NOT NULL
         AND mi.photo_analysis_processed_at IS NOT NULL
         AND mi.deleted_at IS NULL
         ${folderFilter}
         AND NOT EXISTS (
           SELECT 1 FROM media_embeddings me
           WHERE me.media_item_id = mi.id
             AND me.library_id = ?
             AND me.embedding_type = 'text'
             AND me.model_version = ?
         )`,
    ).all(libraryId, ...folderParams, libraryId, MULTIMODAL_EMBED_MODEL) as Array<{
      id: string;
      ai_metadata: string;
    }>;

    const total = rows.length;
    console.log(`[desc-embed-backfill] job ${jobId}: found ${total} items in ${folderPath}`);
    sendDescEmbedProgress({ type: "started", jobId, total });

    let indexed = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      if (abort.signal.aborted) {
        sendDescEmbedProgress({ type: "cancelled", jobId });
        return;
      }

      try {
        const parsed = JSON.parse(row.ai_metadata) as Record<string, unknown>;
        const title = getAiTitle(parsed);
        const description = getAiDescription(parsed);
        const parts = [title, description].filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0,
        );
        const captionText = parts.join(". ").trim();
        if (!captionText) {
          skipped += 1;
        } else {
          const vector = await embedTextForDocument(captionText, abort.signal);
          vectorStore.upsertEmbedding({
            mediaItemId: row.id,
            embeddingType: "text",
            embeddingSource: "ai_metadata",
            modelVersion: MULTIMODAL_EMBED_MODEL,
            vector,
          });
          indexed += 1;
        }
      } catch {
        if (abort.signal.aborted) {
          sendDescEmbedProgress({ type: "cancelled", jobId });
          return;
        }
        failed += 1;
      }

      sendDescEmbedProgress({
        type: "progress",
        jobId,
        processed: indexed + skipped + failed,
        total,
        indexed,
        skipped,
        failed,
      });
    }

    console.log(`[desc-embed-backfill] job ${jobId}: done indexed=${indexed} skipped=${skipped} failed=${failed}`);
    sendDescEmbedProgress({ type: "completed", jobId, indexed, skipped, failed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Description embedding backfill failed";
    console.error(`[desc-embed-backfill] job ${jobId}: error`, err);
    sendDescEmbedProgress({ type: "failed", jobId, error: message });
  } finally {
    descEmbedBackfillAbort = null;
    descEmbedBackfillJobId = null;
  }
}

function finalizeCancelledSemanticJob(job: RunningSemanticIndexJob): void {
  if (job.finalized) return;
  job.finalized = true;

  let cancelledNow = 0;
  for (const item of job.itemsByPath.values()) {
    if (item.status === "settled") continue;
    item.status = "settled";
    cancelledNow += 1;
  }
  job.cancelledCount += cancelledNow;

  emitSemanticIndexProgress(job.browserWindow, {
    type: "job-completed",
    jobId: job.jobId,
    folderPath: job.folderPath,
    completed: job.completed,
    failed: job.failed,
    cancelled: job.cancelledCount,
    averageSecondsPerFile:
      job.completed > 0 ? job.totalElapsedSeconds / job.completed : 0,
  });
  setFolderAnalysisInProgress(job.folderPath, "semantic", false);
  if (job.completed > 0 || job.failed > 0) {
    markFolderSemanticIndexed(job.folderPath);
  }
  clearVectorCache();
  clearDescriptionVectorCache();
  if (job.powerSaveToken) {
    releasePowerSave(job.powerSaveToken);
    job.powerSaveToken = undefined;
  }
}

async function runSemanticIndexJob(
  job: RunningSemanticIndexJob,
  selected: Array<{ path: string; name: string; folderPath: string }>,
  appSettings: import("../../src/shared/ipc").AppSettings,
): Promise<void> {
  const { browserWindow, jobId, folderPath } = job;

  const folderTotals = new Map<string, number>();
  const folderDone = new Map<string, number>();
  for (const img of selected) {
    folderTotals.set(img.folderPath, (folderTotals.get(img.folderPath) ?? 0) + 1);
    folderDone.set(img.folderPath, 0);
  }

  function markSemanticFolderDoneIfComplete(fp: string): void {
    const done = folderDone.get(fp) ?? 0;
    const total = folderTotals.get(fp) ?? 0;
    if (done >= total && total > 0) {
      markFolderSemanticIndexed(fp);
    }
  }

  // Warm up the vision pipeline before processing any images so that
  // model download / ONNX init completes before the first item.
  try {
    logVerbose("[semantic-index] warming up vision pipeline...");
    const t0 = Date.now();
    await warmupVisionPipeline();
    logVerbose(`[semantic-index] vision pipeline ready (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[semantic-index] vision pipeline warmup failed: ${reason}`);
    for (const img of selected) {
      const runtimeItem = job.itemsByPath.get(img.path);
      if (runtimeItem) runtimeItem.status = "settled";
      job.failed += 1;
      folderDone.set(img.folderPath, (folderDone.get(img.folderPath) ?? 0) + 1);
      emitSemanticIndexProgress(browserWindow, {
        type: "item-updated",
        jobId,
        item: { path: img.path, name: img.name, status: "failed", elapsedSeconds: 0, error: reason },
        currentFolderPath: img.folderPath,
      });
    }
    finalizeCancelledSemanticJob(job);
    return;
  }

  if (job.finalized) return;

  emitSemanticIndexProgress(browserWindow, {
    type: "phase-updated",
    jobId,
    phase: "indexing",
  });

  for (const img of selected) {
    if (job.finalized || job.cancelled) {
      const runtimeItem = job.itemsByPath.get(img.path);
      if (runtimeItem && runtimeItem.status !== "settled") {
        runtimeItem.status = "settled";
        job.cancelledCount += 1;
        emitSemanticIndexProgress(browserWindow, {
          type: "item-updated",
          jobId,
          item: { path: img.path, name: img.name, status: "cancelled" },
          currentFolderPath: img.folderPath,
        });
      }
      continue;
    }

    const runtimeItem = job.itemsByPath.get(img.path);
    if (runtimeItem) runtimeItem.status = "running";

    emitSemanticIndexProgress(browserWindow, {
      type: "item-updated",
      jobId,
      item: { path: img.path, name: img.name, status: "running" },
      currentFolderPath: img.folderPath,
    });

    const startMs = Date.now();
    await ensureMetadataForImage(img.path);
    await runWrongImageRotationPrecheck({
      imagePath: img.path,
      settings: appSettings,
    });
    const mediaItemId = ensureMediaItemForPath(img.path);
    if (!mediaItemId) {
      const elapsedSeconds = (Date.now() - startMs) / 1000;
      job.totalElapsedSeconds += elapsedSeconds;
      job.failed += 1;
      if (runtimeItem) runtimeItem.status = "settled";
      folderDone.set(img.folderPath, (folderDone.get(img.folderPath) ?? 0) + 1);
      emitSemanticIndexProgress(browserWindow, {
        type: "item-updated",
        jobId,
        item: {
          path: img.path,
          name: img.name,
          status: "failed",
          elapsedSeconds,
          error: "Failed to create media item",
        },
        currentFolderPath: img.folderPath,
      });
      markSemanticFolderDoneIfComplete(img.folderPath);
      continue;
    }

    vectorStore.markEmbeddingIndexing({
      mediaItemId,
      embeddingType: "image",
      modelVersion: MULTIMODAL_EMBED_MODEL,
    });

    let itemSucceeded = false;
    let itemError: string | undefined;

    try {
      const controller = new AbortController();
      job.controllers.add(controller);
      try {
        const vector = await embedImageDirect(img.path, controller.signal);
        const embeddingSource: import("@emk/shared-contracts").EmbeddingSource = "direct_vision";
        logVerbose(`[semantic-index] ${img.name}: direct vision embedding (${vector.length}-dim)`);

        vectorStore.upsertEmbedding({
          mediaItemId,
          embeddingType: "image",
          embeddingSource,
          modelVersion: MULTIMODAL_EMBED_MODEL,
          vector,
        });
        itemSucceeded = true;
      } finally {
        job.controllers.delete(controller);
      }
    } catch (error) {
      itemError = error instanceof Error ? error.message : "Embedding failed";
      logVerbose(`[semantic-index] ${img.name}: FAILED - ${itemError}`);
      vectorStore.markEmbeddingFailed({
        mediaItemId,
        embeddingType: "image",
        modelVersion: MULTIMODAL_EMBED_MODEL,
        error: itemError,
      });
    }

    if (job.finalized || job.cancelled) return;

    const elapsedSeconds = (Date.now() - startMs) / 1000;
    job.totalElapsedSeconds += elapsedSeconds;
    folderDone.set(img.folderPath, (folderDone.get(img.folderPath) ?? 0) + 1);
    if (runtimeItem) runtimeItem.status = "settled";

    if (itemSucceeded) {
      job.completed += 1;
      emitSemanticIndexProgress(browserWindow, {
        type: "item-updated",
        jobId,
        item: { path: img.path, name: img.name, status: "success", elapsedSeconds },
        currentFolderPath: img.folderPath,
      });
    } else {
      job.failed += 1;
      emitSemanticIndexProgress(browserWindow, {
        type: "item-updated",
        jobId,
        item: { path: img.path, name: img.name, status: "failed", elapsedSeconds, error: itemError },
        currentFolderPath: img.folderPath,
      });
    }

    markSemanticFolderDoneIfComplete(img.folderPath);

    if (itemSucceeded) {
      appendSyncOperation({
        mediaId: mediaItemId,
        operationType: "media.ai.annotate",
        payload: {
          analysisType: "semantic_embedding",
          embeddingModel: MULTIMODAL_EMBED_MODEL,
          sourcePath: img.path,
          completedAt: new Date().toISOString(),
        },
      });
    }
  }

  if (job.finalized) return;

  for (const fp of folderTotals.keys()) {
    markSemanticFolderDoneIfComplete(fp);
  }

  job.finalized = true;
  const settled = job.completed + job.failed + job.cancelledCount;
  emitSemanticIndexProgress(browserWindow, {
    type: "job-completed",
    jobId,
    folderPath,
    completed: job.completed,
    failed: job.failed,
    cancelled: job.cancelledCount,
    averageSecondsPerFile: settled > 0 ? job.totalElapsedSeconds / settled : 0,
  });
  setFolderAnalysisInProgress(folderPath, "semantic", false);
  clearVectorCache();
  clearDescriptionVectorCache();
  if (job.completed > 0 || job.failed > 0) {
    markFolderSemanticIndexed(folderPath);
  }
}

interface AnnotatedEntry { name: string; score: number; mediaItemId: string }

const SEMANTIC_SEARCH_SCORE_LOG_INDENT = "     ";

function logSemanticSearchTopScoreBreakdown(
  rows: SemanticSearchRow[],
  vlmScoreById: Map<string, number>,
  descriptionScoreById: Map<string, number>,
  keywordScoreById: Map<string, number>,
  topN: number,
): void {
  const n = Math.min(rows.length, topN);
  for (let idx = 0; idx < n; idx += 1) {
    const row = rows[idx];
    const vlm = vlmScoreById.get(row.mediaItemId);
    const desc = descriptionScoreById.get(row.mediaItemId);
    const kw = keywordScoreById.get(row.mediaItemId);
    logVerbose(`${idx + 1} - ${row.name}`);
    logVerbose(
      `${SEMANTIC_SEARCH_SCORE_LOG_INDENT}${row.score.toFixed(6)} - Overall`,
    );
    logVerbose(
      `${SEMANTIC_SEARCH_SCORE_LOG_INDENT}${vlm !== undefined ? vlm.toFixed(6) : "—"} - VLM match`,
    );
    logVerbose(
      `${SEMANTIC_SEARCH_SCORE_LOG_INDENT}${desc !== undefined ? desc.toFixed(6) : "—"} - AI description match`,
    );
    logVerbose(
      `${SEMANTIC_SEARCH_SCORE_LOG_INDENT}${kw !== undefined ? kw.toFixed(6) : "—"} - Keywords match`,
    );
  }
}

function annotateConfirmedVsUnconfirmed(
  rows: SemanticSearchRow[],
  personTagIds: string[],
): { confirmed: AnnotatedEntry[]; unconfirmed: AnnotatedEntry[]; noMatch: AnnotatedEntry[] } {
  const db = getDesktopDatabase();
  const confirmed: AnnotatedEntry[] = [];
  const unconfirmed: AnnotatedEntry[] = [];
  const noMatch: AnnotatedEntry[] = [];

  for (const row of rows) {
    let isConfirmed = false;
    let isSuggested = false;

    for (const tagId of personTagIds) {
      const tagRow = db
        .prepare(
          `SELECT 1 FROM media_face_instances
           WHERE media_item_id = ? AND library_id = (SELECT library_id FROM media_items WHERE id = ? LIMIT 1) AND tag_id = ?
           LIMIT 1`,
        )
        .get(row.mediaItemId, row.mediaItemId, tagId) as unknown | undefined;
      if (tagRow) {
        isConfirmed = true;
        break;
      }

      const sugRow = db
        .prepare(
          `SELECT 1 FROM media_item_person_suggestions
           WHERE media_item_id = ? AND tag_id = ?
           LIMIT 1`,
        )
        .get(row.mediaItemId, tagId) as unknown | undefined;
      if (sugRow) {
        isSuggested = true;
      }
    }

    const entry = { name: row.name, score: row.score, mediaItemId: row.mediaItemId };
    if (isConfirmed) {
      confirmed.push(entry);
    } else if (isSuggested) {
      unconfirmed.push(entry);
    } else {
      noMatch.push(entry);
    }
  }

  return { confirmed, unconfirmed, noMatch };
}

function getExistingCaption(photoPath: string): string | null {
  const context = getMediaItemContextByPath(photoPath);
  if (!context?.aiMetadata) {
    return null;
  }
  try {
    const parsed = JSON.parse(context.aiMetadata) as unknown;
    const parts = [getAiTitle(parsed), getAiDescription(parsed)].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
    const caption = parts.join(". ").trim();
    return caption.length > 0 ? caption : null;
  } catch {
    return null;
  }
}

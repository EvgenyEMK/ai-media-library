import { randomUUID } from "node:crypto";
import { app, ipcMain } from "electron";
import {
  IPC_CHANNELS,
  type MetadataScanItemState,
  type MetadataScanTriggerSource,
} from "../../src/shared/ipc";
import {
  getMediaItemMetadataByPaths,
  upsertMediaItemFromFilePath,
} from "../db/media-item-metadata";
import { runPathExtractionForMediaItem } from "../db/media-item-path-extraction";
import {
  finalizeObserveFilesTombstonesForScan,
  getObservedFileStateByPaths,
  observeFiles,
} from "../db/file-identity";
import {
  reconcileFolder,
  purgeDeletedMediaItems,
  hardPurgeSoftDeletedMediaItemsByIds,
} from "../db/media-item-reconciliation";
import {
  DEFAULT_LIBRARY_ID,
  pruneFolderAnalysisStatusesNotInSet,
} from "../db/folder-analysis-status";
import { readSettings } from "../storage";
import { emitMetadataScanProgress } from "./progress-emitters";
import { runningMetadataScanJobs } from "./state";
import type { RunningMetadataScanJob } from "./types";
import {
  collectFoldersRecursivelyWithProgress,
  collectLibraryFileEntriesForFoldersWithProgress,
} from "./folder-utils";
import { acquirePowerSave, releasePowerSave } from "./power-save-manager";
import { isGeocoderReady, initGeocoder, reverseGeocodeBatch } from "../geocoder/reverse-geocoder";
import { getMediaItemsNeedingGpsGeocoding, updateMediaItemLocationFromGps } from "../db/media-item-geocoding";

export function registerMetadataScanHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.scanFolderMetadata,
    async (
      _event,
      request: { folderPath: string; recursive?: boolean },
    ): Promise<{ jobId: string; total: number }> => {
      const folderPath = request.folderPath?.trim();
      if (!folderPath) {
        throw new Error("Folder path is required for metadata scan");
      }
      return runMetadataScanJob({
        folderPath,
        recursive: request.recursive === true,
        triggerSource: "manual",
      });
    },
  );

  ipcMain.handle(IPC_CHANNELS.cancelMetadataScan, async (_event, jobId: string) => {
    const target = runningMetadataScanJobs.get(jobId);
    const totalJobs = runningMetadataScanJobs.size;
    for (const job of runningMetadataScanJobs.values()) {
      job.cancelled = true;
      if (job.powerSaveToken) {
        releasePowerSave(job.powerSaveToken);
        job.powerSaveToken = undefined;
      }
    }
    console.log(`[metadata-scan][${new Date().toISOString()}] cancel requested jobId=${jobId} targetFound=${target != null} totalJobsCancelled=${totalJobs}`);
    return target != null;
  });

  ipcMain.handle(
    IPC_CHANNELS.getMediaItemsByPaths,
    async (_event, paths: string[]): Promise<ReturnType<typeof getMediaItemMetadataByPaths>> => {
      return getMediaItemMetadataByPaths(paths);
    },
  );

  ipcMain.handle(IPC_CHANNELS.purgeDeletedMediaItems, async () => {
    return purgeDeletedMediaItems();
  });

  ipcMain.handle(IPC_CHANNELS.purgeSoftDeletedMediaItemsByIds, async (_event, mediaItemIds: unknown) => {
    const ids = Array.isArray(mediaItemIds)
      ? mediaItemIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    return hardPurgeSoftDeletedMediaItemsByIds(ids);
  });
}

export async function runMetadataScanJob(params: {
  folderPath: string;
  recursive: boolean;
  knownCatalogEntries?: Array<{ folderPath: string; path: string; name: string }>;
  /** Menu-driven scan vs folder-selection auto scan; controls detailed result UI on the renderer. */
  triggerSource?: MetadataScanTriggerSource;
}): Promise<{ jobId: string; total: number }> {
  const triggerSource: MetadataScanTriggerSource = params.triggerSource ?? "auto";
  const jobId = randomUUID();
  const job: RunningMetadataScanJob = { cancelled: false, triggerSource };
  job.powerSaveToken = acquirePowerSave(`metadata-scan:${params.folderPath}`);
  runningMetadataScanJobs.set(jobId, job);

  let scanEntries: Array<{ folderPath: string; path: string; name: string }>;

  if (params.knownCatalogEntries) {
    scanEntries = params.knownCatalogEntries;
  } else {
    const folders = params.recursive
      ? await collectFoldersRecursivelyWithProgress(params.folderPath)
      : [params.folderPath];
    scanEntries = await collectLibraryFileEntriesForFoldersWithProgress(folders);
  }

  const items: MetadataScanItemState[] = scanEntries.map((entry) => ({
    path: entry.path,
    name: entry.name,
    status: "pending",
  }));

  emitMetadataScanProgress({
    type: "job-started",
    jobId,
    folderPath: params.folderPath,
    recursive: params.recursive,
    triggerSource,
    total: items.length,
    items,
  });

  const scanT0 = Date.now();
  const scanTs = () => `${new Date().toISOString()} +${Date.now() - scanT0}ms`;
  console.log(`[metadata-scan][${scanTs()}] job-started jobId=${jobId} total=${scanEntries.length}`);

  emitMetadataScanProgress({
    type: "phase-updated",
    jobId,
    phase: "preparing",
    processed: 0,
    total: scanEntries.length,
  });

  const PHASE_THROTTLE = 10;
  const YIELD_INTERVAL = 5;
  const entriesByFolder = new Map<string, string[]>();
  for (const entry of scanEntries) {
    const current = entriesByFolder.get(entry.folderPath);
    if (current) {
      current.push(entry.path);
    } else {
      entriesByFolder.set(entry.folderPath, [entry.path]);
    }
  }

  let preparingProcessed = 0;
  let lastEmittedPreparing = 0;
  const preparingTotal = scanEntries.length;
  const totalFoldersToPrepare = entriesByFolder.size;
  let foldersPreparedCount = 0;
  const pathMoves: Array<{ previousPath: string; newPath: string }> = [];
  for (const [folderPath, paths] of entriesByFolder.entries()) {
    if (job.cancelled) break;
    await observeFiles(
      paths,
      folderPath,
      DEFAULT_LIBRARY_ID,
      (folderProcessed) => {
        const current = preparingProcessed + folderProcessed;
        if (current - lastEmittedPreparing >= PHASE_THROTTLE || current === preparingTotal) {
          lastEmittedPreparing = current;
          emitMetadataScanProgress({
            type: "phase-updated",
            jobId,
            phase: "preparing",
            processed: current,
            total: preparingTotal,
          });
        }
      },
      () => job.cancelled,
      (previousPath, newPath) => {
        pathMoves.push({ previousPath, newPath });
      },
      true,
    );
    if (job.cancelled) {
      console.log(`[metadata-scan][${scanTs()}] preparing CANCELLED after observeFiles jobId=${jobId} processed=${preparingProcessed}/${preparingTotal}`);
      break;
    }
    foldersPreparedCount += 1;
    preparingProcessed += paths.length;
  }

  if (!job.cancelled && foldersPreparedCount === totalFoldersToPrepare) {
    finalizeObserveFilesTombstonesForScan(entriesByFolder, DEFAULT_LIBRARY_ID);
  }

  const prepareCompletedFully = foldersPreparedCount === totalFoldersToPrepare;

  const filesCreated: Array<{ path: string; name: string }> = [];
  const filesUpdated: Array<{ path: string; name: string }> = [];
  const filesFailed: Array<{ path: string; name: string; error?: string }> = [];
  const filesDeleted: Array<{ id: string; sourcePath: string }> = [];

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;
  let cancelled = 0;
  let scanningProcessed = 0;
  let filesNeedingAiPipelineFollowUp = 0;
  const observedFolders = new Set<string>([params.folderPath]);
  const folderTouchMap = new Map<
    string,
    { created: number; updated: number; needsAiFollowUp: number }
  >();

  let pathExtractionEnabled = true;
  let gpsGeocodingEnabled = false;
  try {
    const appSettings = await readSettings(app.getPath("userData"));
    pathExtractionEnabled = appSettings.pathExtraction.extractDates;
    gpsGeocodingEnabled = appSettings.folderScanning.detectLocationFromGps;
  } catch {
    // Settings read failure — keep path extraction enabled as default
  }

  try {
    if (!job.cancelled) {
      console.log(`[metadata-scan][${scanTs()}] scanning phase START total=${scanEntries.length}`);
      emitMetadataScanProgress({
        type: "phase-updated",
        jobId,
        phase: "scanning",
        processed: 0,
        total: scanEntries.length,
      });

      const observedByPath = getObservedFileStateByPaths(scanEntries.map((entry) => entry.path));

      for (const entry of scanEntries) {
        if (job.cancelled) {
          cancelled += scanEntries.length - scanningProcessed;
          break;
        }

        const upsert = await upsertMediaItemFromFilePath({
          filePath: entry.path,
          observedState: observedByPath[entry.path],
        });

        if (upsert.status === "failed") {
          failed += 1;
          filesFailed.push({
            path: entry.path,
            name: entry.name,
            error: upsert.error,
          });
        } else if (upsert.status === "created") {
          created += 1;
          filesCreated.push({ path: entry.path, name: entry.name });
          const fp = entry.folderPath;
          const cur = folderTouchMap.get(fp) ?? { created: 0, updated: 0, needsAiFollowUp: 0 };
          cur.created += 1;
          if (upsert.needsAiPipelineFollowUp === true) {
            cur.needsAiFollowUp += 1;
            filesNeedingAiPipelineFollowUp += 1;
          }
          folderTouchMap.set(fp, cur);
        } else if (upsert.status === "updated") {
          updated += 1;
          filesUpdated.push({ path: entry.path, name: entry.name });
          const fp = entry.folderPath;
          const cur = folderTouchMap.get(fp) ?? { created: 0, updated: 0, needsAiFollowUp: 0 };
          cur.updated += 1;
          if (upsert.needsAiPipelineFollowUp === true) {
            cur.needsAiFollowUp += 1;
            filesNeedingAiPipelineFollowUp += 1;
          }
          folderTouchMap.set(fp, cur);
        } else {
          unchanged += 1;
        }

        if (pathExtractionEnabled && upsert.mediaItemId && upsert.status !== "failed" && upsert.status !== "unchanged") {
          try {
            runPathExtractionForMediaItem({
              filePath: entry.path,
              mediaItemId: upsert.mediaItemId,
              photoTakenAt: upsert.photoTakenAt ?? null,
              photoTakenPrecision: (upsert.photoTakenPrecision as "year" | "month" | "day" | "instant") ?? null,
              fileCreatedAt: upsert.fileCreatedAt ?? null,
            });
          } catch {
            // Path extraction is best-effort; never block the scan pipeline
          }
        }
        scanningProcessed += 1;

        if (scanningProcessed % YIELD_INTERVAL === 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }

        if (upsert.status !== "unchanged") {
          emitMetadataScanProgress({
            type: "item-updated",
            jobId,
            currentFolderPath: entry.folderPath,
            item: {
              path: entry.path,
              name: entry.name,
              status: upsert.status === "failed" ? "failed" : "success",
              action:
                upsert.status === "failed"
                  ? "failed"
                  : upsert.status === "created"
                    ? "created"
                    : upsert.status === "updated"
                      ? "updated"
                      : "unchanged",
              mediaItemId: upsert.mediaItemId,
              error: upsert.error,
            },
          });
        }

        if (scanningProcessed % PHASE_THROTTLE === 0 || scanningProcessed === scanEntries.length) {
          emitMetadataScanProgress({
            type: "phase-updated",
            jobId,
            phase: "scanning",
            processed: scanningProcessed,
            total: scanEntries.length,
          });
        }
      }
    } else {
      cancelled = scanEntries.length;
      console.log(`[metadata-scan][${scanTs()}] scanning phase SKIPPED (cancelled) jobId=${jobId} total=${scanEntries.length}`);
    }
    // --- GPS reverse geocoding phase ---
    // Include every cataloged item in the scanned paths, not only created/updated rows,
    // so turning on "detect location from GPS" after an earlier scan still backfills country/city.
    if (!job.cancelled && gpsGeocodingEnabled && scanEntries.length > 0) {
      try {
        if (!isGeocoderReady()) {
          console.log(`[metadata-scan][${scanTs()}] geocoder not ready, initializing…`);
          await initGeocoder(app.getPath("userData"));
        }
        if (isGeocoderReady()) {
          const GPS_BATCH_SIZE = 500;
          const scannedPaths = scanEntries.map((e) => e.path);
          const metaByPath = getMediaItemMetadataByPaths(scannedPaths);
          const scannedMediaItemIds = Object.values(metaByPath).map((m) => m.id);
          const itemsToGeocode = getMediaItemsNeedingGpsGeocoding(scannedMediaItemIds);
          if (itemsToGeocode.length > 0) {
            console.log(`[metadata-scan][${scanTs()}] geocoding ${itemsToGeocode.length} items with GPS coordinates`);
            emitMetadataScanProgress({
              type: "phase-updated",
              jobId,
              phase: "scanning",
              processed: scanningProcessed,
              total: scanEntries.length,
            });

            for (let i = 0; i < itemsToGeocode.length; i += GPS_BATCH_SIZE) {
              if (job.cancelled) break;
              const batch = itemsToGeocode.slice(i, i + GPS_BATCH_SIZE);
              const points = batch.map((r) => ({ latitude: r.latitude, longitude: r.longitude }));
              const results = await reverseGeocodeBatch(points);
              for (let j = 0; j < batch.length; j++) {
                const loc = results[j];
                if (loc) {
                  updateMediaItemLocationFromGps(batch[j].id, loc);
                  // Per-file geocode debug (re-enable when needed) — use return value (>0 rows updated):
                  // const changed = updateMediaItemLocationFromGps(batch[j].id, loc);
                  // if (changed > 0) {
                  //   const geoParts = [loc.countryName, loc.admin1Name, loc.cityName].filter(
                  //     (s): s is string => typeof s === "string" && s.trim().length > 0,
                  //   );
                  //   console.log(
                  //     `[metadata-scan][geocode-updated] ${geoParts.join(" | ")} | ${batch[j].source_path}`,
                  //   );
                  // }
                }
              }
            }
            console.log(`[metadata-scan][${scanTs()}] geocoding complete`);
          }
        }
      } catch (geocodeErr) {
        console.error(`[metadata-scan][${scanTs()}] geocoding phase error:`, geocodeErr);
      }
    }

    if (prepareCompletedFully) {
      const observedByFolder = new Map<string, Set<string>>();
      for (const entry of scanEntries) {
        const current = observedByFolder.get(entry.folderPath);
        if (current) {
          current.add(entry.path);
        } else {
          observedByFolder.set(entry.folderPath, new Set([entry.path]));
        }
      }
      let totalSoftDeleted = 0;
      let totalResurrected = 0;
      for (const [folder, paths] of observedByFolder.entries()) {
        const result = reconcileFolder(folder, paths);
        totalSoftDeleted += result.softDeleted;
        totalResurrected += result.resurrected;
        for (const row of result.softDeletedItems) {
          filesDeleted.push({ id: row.id, sourcePath: row.sourcePath });
        }
      }
      if (totalSoftDeleted > 0 || totalResurrected > 0) {
        console.log(
          `[metadata-scan][${scanTs()}] reconciliation softDeleted=${totalSoftDeleted} resurrected=${totalResurrected}`,
        );
      }
    }

    if (!job.cancelled && params.recursive) {
      for (const folderPath of entriesByFolder.keys()) {
        observedFolders.add(folderPath);
      }
      pruneFolderAnalysisStatusesNotInSet(params.folderPath, observedFolders, DEFAULT_LIBRARY_ID);
    }
  } finally {
    if (job.powerSaveToken) {
      releasePowerSave(job.powerSaveToken);
      job.powerSaveToken = undefined;
    }
    console.log(
      `[metadata-scan][${scanTs()}] job-completed jobId=${jobId} created=${created} updated=${updated} unchanged=${unchanged} failed=${failed} cancelled=${cancelled} needsAiFollowUp=${filesNeedingAiPipelineFollowUp}`,
    );
    const foldersTouched = Array.from(folderTouchMap.entries())
      .map(([folderPath, counts]) => ({
        folderPath,
        created: counts.created,
        updated: counts.updated,
        needsAiFollowUp: counts.needsAiFollowUp,
      }))
      .sort((a, b) => a.folderPath.localeCompare(b.folderPath));

    emitMetadataScanProgress({
      type: "job-completed",
      jobId,
      folderPath: params.folderPath,
      recursive: params.recursive,
      triggerSource,
      total: scanEntries.length,
      created,
      updated,
      unchanged,
      failed,
      cancelled,
      scanCancelled: cancelled > 0,
      filesCreated,
      filesUpdated,
      filesFailed,
      pathMoves,
      filesDeleted,
      filesNeedingAiPipelineFollowUp,
      foldersTouched,
    });
    runningMetadataScanJobs.delete(jobId);
  }

  return { jobId, total: scanEntries.length };
}

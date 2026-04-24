import { randomUUID } from "node:crypto";
import { BrowserWindow, ipcMain } from "electron";
import {
  IPC_CHANNELS,
  type EmbedFolderFacesRequest,
  type FaceDetectionOutput,
} from "../../src/shared/ipc";
import { getDesktopDatabase } from "../db/client";
import {
  getFacesNeedingEmbeddings,
  getEmbeddingStats,
  markFaceEmbeddingStatus,
  upsertFaceEmbedding,
  searchSimilarFaces,
  findMatchesForPerson,
  getClusterMemberFaceIdsForPersonSimilarityFilter,
  getClusterPersonCentroidMatchStatsBatch,
  getFaceToPersonCentroidSimilarities,
  recomputeAndStoreCentroid,
  suggestPersonTagForFaceInstance,
  type FaceForEmbeddingJob,
} from "../db/face-embeddings";
import { getFaceRecognitionSimilarityThreshold } from "../face-recognition-threshold";
import { refreshSuggestionsForTag } from "../db/person-suggestions";
import {
  generateFaceEmbeddings,
  getEmbeddingModelInfo,
  type FaceForEmbedding,
} from "../face-embedding";
import { listFaceInstancesByMediaItem } from "../db/face-tags";
import {
  assignClusterToPersonTag,
  getFaceClusterSummariesPage,
  getFaceClusterTotalCount,
  listClusterFaceIdsPage,
  runClusterUntaggedFacesJob,
  suggestPersonTagForCluster,
  suggestPersonTagsForClusters,
} from "../face-clustering";
import { DEFAULT_LIBRARY_ID } from "../db/folder-analysis-status";
import { ensureFaceDetectionServiceRunning } from "../face-service";
import { createRotatedTempImage } from "../photo-analysis";
import { emitFaceClusteringProgress, emitFaceEmbeddingProgress } from "./progress-emitters";
import { runningFaceClusteringJobs, runningJobs } from "./state";
import type { RunningAnalysisJob } from "./types";
import { clampConcurrency } from "./folder-utils";

export function registerFaceEmbeddingHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.embedFolderFaces,
    async (event, request: EmbedFolderFacesRequest) => {
      const serviceReady = await ensureFaceDetectionServiceRunning();
      if (!serviceReady) {
        throw new Error("Face service is unavailable. Ensure ONNX models are downloaded.");
      }

      const modelInfo = await getEmbeddingModelInfo();
      if (!modelInfo || !modelInfo.loaded) {
        throw new Error("ArcFace embedding model is not loaded.");
      }

      const folderPath = request.folderPath?.trim();
      if (!folderPath) {
        throw new Error("Folder path is required for face embedding");
      }

      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      if (!browserWindow) {
        throw new Error("Unable to locate window for face embedding");
      }

      const facesNeeding = getFacesNeedingEmbeddings(DEFAULT_LIBRARY_ID, folderPath);
      const jobId = randomUUID();
      const job: RunningAnalysisJob = {
        cancelled: false,
        controllers: new Set<AbortController>(),
      };
      runningJobs.set(jobId, job);

      emitFaceEmbeddingProgress(browserWindow, {
        type: "job-started",
        jobId,
        folderPath,
        total: facesNeeding.length,
      });

      const concurrency = clampConcurrency(request.concurrency);

      void runFaceEmbeddingJob(
        browserWindow,
        jobId,
        folderPath,
        facesNeeding,
        modelInfo.modelName,
        modelInfo.dimension,
        concurrency,
      ).finally(() => {
        runningJobs.delete(jobId);
      });

      return { jobId, total: facesNeeding.length };
    },
  );

  ipcMain.handle(IPC_CHANNELS.cancelFaceEmbedding, async (_event, jobId: string) => {
    const job = runningJobs.get(jobId);
    if (!job) {
      return false;
    }
    job.cancelled = true;
    job.controllers.forEach((controller) => controller.abort());
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.getEmbeddingModelStatus, async () => {
    const modelInfo = await getEmbeddingModelInfo();
    return {
      modelName: modelInfo?.modelName ?? null,
      dimension: modelInfo?.dimension ?? null,
      loaded: modelInfo?.loaded ?? false,
    };
  });

  ipcMain.handle(IPC_CHANNELS.getEmbeddingStats, async () => {
    return getEmbeddingStats();
  });

  ipcMain.handle(
    IPC_CHANNELS.searchSimilarFaces,
    async (
      _event,
      request: {
        faceInstanceId: string;
        threshold?: number;
        limit?: number;
        taggedOnly?: boolean;
      },
    ) => {
      const db = getDesktopDatabase();
      const row = db
        .prepare(
          `SELECT embedding_json FROM media_face_instances
           WHERE id = ?
             AND embedding_json IS NOT NULL
             AND (embedding_status = 'ready' OR embedding_status IS NULL)`,
        )
        .get(request.faceInstanceId) as { embedding_json: string } | undefined;

      if (!row) {
        return [];
      }

      let queryVector: number[];
      try {
        queryVector = JSON.parse(row.embedding_json) as number[];
      } catch {
        return [];
      }

      return searchSimilarFaces(
        queryVector,
        request.threshold ?? 0.6,
        request.limit ?? 50,
        {
          excludeFaceIds: [request.faceInstanceId],
          taggedOnly: request.taggedOnly,
        },
      );
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.suggestPersonTagForFace,
    async (
      _event,
      request: { faceInstanceId: string; threshold?: number },
    ) => {
      return suggestPersonTagForFaceInstance(request.faceInstanceId, {
        threshold: request.threshold,
      });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.findPersonMatches,
    async (
      _event,
      request: { tagId: string; threshold?: number; limit?: number },
    ) => {
      return findMatchesForPerson(request.tagId, {
        threshold: request.threshold,
        limit: request.limit,
      });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.getClusterPersonMatchStatsBatch,
    async (
      _event,
      request: {
        items: Array<{ clusterId: string; tagId: string }>;
        threshold?: number;
      },
    ) => {
      return getClusterPersonCentroidMatchStatsBatch(request.items, {
        threshold: request.threshold,
      });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.getClusterMemberFaceIdsForPersonSimilarityFilter,
    async (
      _event,
      request: {
        clusterId: string;
        tagId: string;
        mode: "matching" | "mid" | "below";
        threshold?: number;
      },
    ) => {
      return getClusterMemberFaceIdsForPersonSimilarityFilter(
        request.clusterId,
        request.tagId,
        request.mode,
        { threshold: request.threshold },
      );
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.getFaceClusters,
    async (_event, request?: { offset?: number; limit?: number }) => {
      const offset = request?.offset ?? 0;
      const limit = request?.limit ?? 10;
      const totalCount = getFaceClusterTotalCount();
      const clusters = getFaceClusterSummariesPage({ offset, limit });
      return { clusters, totalCount };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.listClusterFaceIds,
    async (
      _event,
      clusterId: string,
      opts?: { offset?: number; limit?: number },
    ) => {
      return listClusterFaceIdsPage(clusterId, opts ?? {});
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.runFaceClustering,
    async (event, options?: { similarityThreshold?: number; minClusterSize?: number }) => {
      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      if (!browserWindow) {
        throw new Error("Unable to locate window for face clustering");
      }
      const jobId = randomUUID();
      runningFaceClusteringJobs.set(jobId, { cancelled: false });

      void (async () => {
        try {
          const result = await runClusterUntaggedFacesJob({
            similarityThreshold: options?.similarityThreshold,
            minClusterSize: options?.minClusterSize,
            shouldCancel: () =>
              runningFaceClusteringJobs.get(jobId)?.cancelled ?? true,
            onFacesLoaded: (totalFaces) => {
              emitFaceClusteringProgress(browserWindow, {
                type: "job-started",
                jobId,
                totalFaces,
              });
            },
            onProgress: (payload) => {
              const phase =
                payload.phase === "clustering" ? "clustering" : "persisting";
              emitFaceClusteringProgress(browserWindow, {
                type: "progress",
                jobId,
                phase,
                processed: payload.processed,
                total: payload.total,
              });
            },
          });

          if (result.status === "cancelled") {
            emitFaceClusteringProgress(browserWindow, {
              type: "job-cancelled",
              jobId,
            });
            return;
          }

          try {
            const { refreshAllSuggestionsWithProgress } = await import("../db/person-suggestions");
            const suggestionThreshold = await getFaceRecognitionSimilarityThreshold();
            const suggestionRefresh = refreshAllSuggestionsWithProgress(
              { threshold: suggestionThreshold },
              ({ processedTags, totalTags }) => {
                emitFaceClusteringProgress(browserWindow, {
                  type: "progress",
                  jobId,
                  phase: "refreshing-suggestions",
                  processed: processedTags,
                  total: totalTags,
                });
              },
            );
            console.log(
              `[face-clustering] refreshed person suggestions after clustering: ${suggestionRefresh.totalSuggestions} suggestions across ${suggestionRefresh.totalTags} tags`,
            );
            emitFaceClusteringProgress(browserWindow, {
              type: "job-completed",
              jobId,
              clusterCount: result.clusterCount,
              suggestionsRefreshed: suggestionRefresh.totalSuggestions,
            });
          } catch (suggestError) {
            console.warn("[face-clustering] failed to refresh person suggestions:", suggestError);
            emitFaceClusteringProgress(browserWindow, {
              type: "job-completed",
              jobId,
              clusterCount: result.clusterCount,
            });
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Face clustering failed";
          emitFaceClusteringProgress(browserWindow, {
            type: "job-failed",
            jobId,
            error: message,
          });
        } finally {
          runningFaceClusteringJobs.delete(jobId);
        }
      })();

      return { jobId };
    },
  );

  ipcMain.handle(IPC_CHANNELS.cancelFaceClustering, async (_event, jobId: string) => {
    const job = runningFaceClusteringJobs.get(jobId);
    if (!job) {
      return false;
    }
    job.cancelled = true;
    return true;
  });

  ipcMain.handle(
    IPC_CHANNELS.assignClusterToPerson,
    async (_event, clusterId: string, tagId: string) => {
      const assignedCount = assignClusterToPersonTag(clusterId, tagId);

      const modelInfo = await getEmbeddingModelInfo();
      if (modelInfo) {
        recomputeAndStoreCentroid(tagId, modelInfo.modelName, modelInfo.dimension);
      }
      const suggestionThreshold = await getFaceRecognitionSimilarityThreshold();
      refreshSuggestionsForTag(tagId, { threshold: suggestionThreshold });

      return { assignedCount };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.suggestPersonTagForCluster,
    async (_event, clusterId: string, threshold?: number) => {
      return suggestPersonTagForCluster(clusterId, { threshold });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.suggestPersonTagsForClusters,
    async (_event, clusterIds: string[], threshold?: number) => {
      return suggestPersonTagsForClusters(clusterIds, { threshold });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.getFaceToPersonCentroidSimilarities,
    async (_event, faceInstanceIds: string[], tagId: string) => {
      return getFaceToPersonCentroidSimilarities(faceInstanceIds, tagId);
    },
  );

  ipcMain.handle(IPC_CHANNELS.refreshPersonSuggestions, async () => {
    const { refreshAllSuggestions } = await import("../db/person-suggestions");
    const suggestionThreshold = await getFaceRecognitionSimilarityThreshold();
    const count = refreshAllSuggestions({ threshold: suggestionThreshold });
    return { count };
  });

  ipcMain.handle(
    IPC_CHANNELS.reprocessFaceCropsAndEmbeddings,
    async () => {
      const serviceReady = await ensureFaceDetectionServiceRunning();
      if (!serviceReady) {
        throw new Error("Face service is unavailable. Ensure ONNX models are downloaded.");
      }

      const facesNeedingEmbeddings = getFacesNeedingEmbeddings();

      const modelInfo = await getEmbeddingModelInfo();
      if (!modelInfo?.loaded) {
        throw new Error("ArcFace embedding model is not loaded.");
      }

      if (facesNeedingEmbeddings.length > 0) {
        const embeddingsByImage = new Map<string, FaceForEmbeddingJob[]>();
        for (const face of facesNeedingEmbeddings) {
          const group = embeddingsByImage.get(face.sourcePath);
          if (group) {
            group.push(face);
          } else {
            embeddingsByImage.set(face.sourcePath, [face]);
          }
        }

        for (const [sourcePath, groupFaces] of embeddingsByImage) {
          try {
            const facesForApi: FaceForEmbedding[] = groupFaces.map((face) => {
              const landmarks = JSON.parse(face.landmarks_json) as Array<[number, number]>;
              return {
                bbox_xyxy: [
                  face.bbox_x,
                  face.bbox_y,
                  face.bbox_x + face.bbox_width,
                  face.bbox_y + face.bbox_height,
                ] as [number, number, number, number],
                landmarks_5: landmarks,
              };
            });

            for (const face of groupFaces) {
              markFaceEmbeddingStatus(face.faceInstanceId, "indexing");
            }

            const result = await generateFaceEmbeddings({
              imagePath: sourcePath,
              faces: facesForApi,
            });

            for (let i = 0; i < groupFaces.length; i++) {
              const face = groupFaces[i];
              const embedding = result.embeddings.find((e) => e.face_index === i);
              if (embedding) {
                upsertFaceEmbedding(
                  face.faceInstanceId,
                  embedding.vector,
                  result.modelName,
                  embedding.dimension,
                );
              } else {
                markFaceEmbeddingStatus(face.faceInstanceId, "failed");
              }
            }
          } catch {
            for (const face of groupFaces) {
              markFaceEmbeddingStatus(face.faceInstanceId, "failed");
            }
          }
        }
      }

      return {
        totalCropsNeeded: 0,
        totalEmbeddingsNeeded: facesNeedingEmbeddings.length,
      };
    },
  );
}

/**
 * After face detection completes for a media item, automatically generate
 * embeddings for all detected faces. Non-fatal: failures are silently caught.
 */
export async function autoChainEmbeddings(
  mediaItemId: string,
  imagePath: string,
  _detectionResult: FaceDetectionOutput,
  signal?: AbortSignal,
  preferredRotationClockwise?: 0 | 90 | 180 | 270,
  embeddingOverride?: { imagePath: string; faces: FaceDetectionOutput; cleanup?: () => Promise<void> },
): Promise<void> {
  const instances = listFaceInstancesByMediaItem(mediaItemId);
  if (instances.length === 0) return;

  try {
    const modelInfo = await getEmbeddingModelInfo();
    if (!modelInfo?.loaded) return;

    let embeddingImagePath = embeddingOverride?.imagePath ?? imagePath;
    let cleanupRotatedImage: (() => Promise<void>) | null = null;
    const shouldEmbedFromRotatedCopy =
      preferredRotationClockwise === 90 ||
      preferredRotationClockwise === 180 ||
      preferredRotationClockwise === 270;
    if (embeddingOverride?.cleanup) {
      cleanupRotatedImage = embeddingOverride.cleanup;
    } else if (shouldEmbedFromRotatedCopy) {
      const rotated = await createRotatedTempImage(imagePath, preferredRotationClockwise);
      embeddingImagePath = rotated.path;
      cleanupRotatedImage = rotated.cleanup;
    }

    const facesForEmbed: FaceForEmbedding[] = [];
    const embeddableInstances: typeof instances = [];

    for (let idx = 0; idx < instances.length; idx++) {
      const inst = instances[idx];
      const overrideFace = embeddingOverride?.faces.faces[idx];
      const sourceBox = [
        inst.bounding_box.x ?? 0,
        inst.bounding_box.y ?? 0,
        (inst.bounding_box.x ?? 0) + (inst.bounding_box.width ?? 0),
        (inst.bounding_box.y ?? 0) + (inst.bounding_box.height ?? 0),
      ] as [number, number, number, number];
      const transformed =
        overrideFace
          ? { bbox: overrideFace.bbox_xyxy, landmarks: overrideFace.landmarks_5 }
          :
        shouldEmbedFromRotatedCopy && inst.ref_image_width && inst.ref_image_height
          ? transformFaceForRotatedEmbedding({
              bbox: sourceBox,
              landmarks: inst.landmarks_5 ?? null,
              angle: preferredRotationClockwise,
              originalSize: {
                width: inst.ref_image_width,
                height: inst.ref_image_height,
              },
            })
          : { bbox: sourceBox, landmarks: inst.landmarks_5 ?? undefined };
      facesForEmbed.push({
        bbox_xyxy: transformed.bbox,
        landmarks_5: transformed.landmarks,
      });
      embeddableInstances.push(inst);
    }

    if (facesForEmbed.length === 0) return;

    for (const inst of embeddableInstances) {
      markFaceEmbeddingStatus(inst.id, "indexing");
    }

    const embedResult = await generateFaceEmbeddings({
      imagePath: embeddingImagePath,
      faces: facesForEmbed,
      signal,
    });
    if (cleanupRotatedImage) {
      await cleanupRotatedImage();
      cleanupRotatedImage = null;
    }

    for (let i = 0; i < embeddableInstances.length; i++) {
      const inst = embeddableInstances[i];
      const embedding = embedResult.embeddings.find((e) => e.face_index === i);
      if (embedding) {
        upsertFaceEmbedding(
          inst.id,
          embedding.vector,
          embedResult.modelName,
          embedding.dimension,
        );
      } else {
        markFaceEmbeddingStatus(inst.id, "failed");
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(
      `[emk-face-debug][chain-embed] fail path=${imagePath} msg=${JSON.stringify(msg)}`,
    );
    // Embedding failure is non-fatal for the detection pipeline
  }
}

function transformFaceForRotatedEmbedding(params: {
  bbox: [number, number, number, number];
  landmarks: Array<[number, number]> | null;
  angle: 90 | 180 | 270;
  originalSize: { width: number; height: number };
}): { bbox: [number, number, number, number]; landmarks?: Array<[number, number]> } {
  const { bbox, landmarks, angle, originalSize } = params;
  const [x1, y1, x2, y2] = bbox;
  const p1 = transformOriginalPointToRotated(x1, y1, angle, originalSize);
  const p2 = transformOriginalPointToRotated(x2, y2, angle, originalSize);
  const transformedLandmarks = landmarks?.map(([x, y]) => {
    const p = transformOriginalPointToRotated(x, y, angle, originalSize);
    return [p.x, p.y] as [number, number];
  });
  return {
    bbox: [
      Math.min(p1.x, p2.x),
      Math.min(p1.y, p2.y),
      Math.max(p1.x, p2.x),
      Math.max(p1.y, p2.y),
    ],
    landmarks: transformedLandmarks,
  };
}

function transformOriginalPointToRotated(
  x: number,
  y: number,
  angleCw: 90 | 180 | 270,
  originalSize: { width: number; height: number },
): { x: number; y: number } {
  switch (angleCw) {
    case 90:
      return { x: originalSize.height - 1 - y, y: x };
    case 180:
      return { x: originalSize.width - 1 - x, y: originalSize.height - 1 - y };
    case 270:
      return { x: y, y: originalSize.width - 1 - x };
  }
}

async function runFaceEmbeddingJob(
  browserWindow: BrowserWindow,
  jobId: string,
  folderPath: string,
  faces: FaceForEmbeddingJob[],
  modelName: string,
  modelDimension: number,
  concurrency: number,
): Promise<void> {
  const job = runningJobs.get(jobId);
  if (!job) {
    return;
  }

  const grouped = new Map<string, FaceForEmbeddingJob[]>();
  for (const face of faces) {
    const group = grouped.get(face.sourcePath);
    if (group) {
      group.push(face);
    } else {
      grouped.set(face.sourcePath, [face]);
    }
  }

  const imageGroups = Array.from(grouped.entries());
  let nextIndex = 0;
  let embedded = 0;
  let failed = 0;
  let cancelled = 0;

  const runWorker = async (): Promise<void> => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= imageGroups.length) {
        return;
      }

      const [sourcePath, groupFaces] = imageGroups[currentIndex];

      if (job.cancelled) {
        cancelled += groupFaces.length;
        for (const face of groupFaces) {
          emitFaceEmbeddingProgress(browserWindow, {
            type: "item-updated",
            jobId,
            faceInstanceId: face.faceInstanceId,
            status: "cancelled",
          });
        }
        continue;
      }

      for (const face of groupFaces) {
        markFaceEmbeddingStatus(face.faceInstanceId, "indexing");
        emitFaceEmbeddingProgress(browserWindow, {
          type: "item-updated",
          jobId,
          faceInstanceId: face.faceInstanceId,
          status: "running",
        });
      }

      const controller = new AbortController();
      job.controllers.add(controller);

      try {
        const facesForApi: FaceForEmbedding[] = groupFaces.map((face) => {
          let landmarks: Array<[number, number]> | undefined;
          if (face.landmarks_json) {
            try {
              const parsed = JSON.parse(face.landmarks_json) as Array<[number, number]>;
              if (Array.isArray(parsed) && parsed.length === 5) {
                landmarks = parsed;
              }
            } catch {
              landmarks = undefined;
            }
          }
          return {
            bbox_xyxy: [
              face.bbox_x,
              face.bbox_y,
              face.bbox_x + face.bbox_width,
              face.bbox_y + face.bbox_height,
            ] as [number, number, number, number],
            landmarks_5: landmarks,
          };
        });

        const result = await generateFaceEmbeddings({
          imagePath: sourcePath,
          faces: facesForApi,
          signal: controller.signal,
        });

        for (let i = 0; i < groupFaces.length; i++) {
          const face = groupFaces[i];
          const embeddingResult = result.embeddings.find(
            (e) => e.face_index === i,
          );

          if (embeddingResult) {
            upsertFaceEmbedding(
              face.faceInstanceId,
              embeddingResult.vector,
              result.modelName,
              embeddingResult.dimension,
            );
            embedded += 1;
            emitFaceEmbeddingProgress(browserWindow, {
              type: "item-updated",
              jobId,
              faceInstanceId: face.faceInstanceId,
              status: "success",
            });
          } else {
            markFaceEmbeddingStatus(face.faceInstanceId, "failed");
            failed += 1;
            emitFaceEmbeddingProgress(browserWindow, {
              type: "item-updated",
              jobId,
              faceInstanceId: face.faceInstanceId,
              status: "failed",
              error: "No embedding returned for this face",
            });
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown embedding error";

        for (const face of groupFaces) {
          if (job.cancelled) {
            cancelled += 1;
            emitFaceEmbeddingProgress(browserWindow, {
              type: "item-updated",
              jobId,
              faceInstanceId: face.faceInstanceId,
              status: "cancelled",
            });
          } else {
            markFaceEmbeddingStatus(face.faceInstanceId, "failed");
            failed += 1;
            emitFaceEmbeddingProgress(browserWindow, {
              type: "item-updated",
              jobId,
              faceInstanceId: face.faceInstanceId,
              status: "failed",
              error: errorMessage,
            });
          }
        }
      } finally {
        job.controllers.delete(controller);
      }
    }
  };

  const workerCount = Math.min(concurrency, Math.max(1, imageGroups.length));
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  emitFaceEmbeddingProgress(browserWindow, {
    type: "job-completed",
    jobId,
    folderPath,
    embedded,
    failed,
    cancelled,
  });
}

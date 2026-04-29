import type { PipelineDefinition } from "../pipeline-registry";
import { getEmbeddingModelInfo, generateFaceEmbeddings, type FaceForEmbedding } from "../../face-embedding";
import { listFaceInstancesByMediaItem } from "../../db/face-tags";
import { markFaceEmbeddingStatus, upsertFaceEmbedding } from "../../db/face-embeddings";
import { getDesktopDatabase } from "../../db/client";
import { DEFAULT_LIBRARY_ID } from "../../db/folder-analysis-status";

export interface FaceEmbeddingParams {
  mediaItemIds?: string[];
  folderPath?: string;
  recursive?: boolean;
}

export interface FaceEmbeddingOutput {
  totalFaces: number;
  embedded: number;
  failed: number;
  cancelled: number;
}

function validateParams(params: unknown):
  | { ok: true; value: FaceEmbeddingParams }
  | { ok: false; issues: string } {
  if (typeof params !== "object" || params === null) {
    return { ok: false, issues: "params must be an object" };
  }
  const candidate = params as Record<string, unknown>;
  const mediaItemIds = Array.isArray(candidate.mediaItemIds)
    ? candidate.mediaItemIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : undefined;
  const folderPath =
    typeof candidate.folderPath === "string" && candidate.folderPath.trim().length > 0
      ? candidate.folderPath.trim()
      : undefined;
  if ((!mediaItemIds || mediaItemIds.length === 0) && !folderPath) {
    return { ok: false, issues: "either mediaItemIds or folderPath is required" };
  }
  return {
    ok: true,
    value: {
      mediaItemIds,
      folderPath,
      recursive: candidate.recursive !== false,
    },
  };
}

interface EmbeddableFace {
  id: string;
  sourcePath: string;
  bbox: [number, number, number, number];
  landmarks: Array<[number, number]> | undefined;
}

function collectFacesForMediaItem(mediaItemId: string): EmbeddableFace[] {
  const db = getDesktopDatabase();
  const row = db
    .prepare(`SELECT source_path FROM media_items WHERE id = ? LIMIT 1`)
    .get(mediaItemId) as { source_path: string } | undefined;
  if (!row?.source_path) return [];
  const instances = listFaceInstancesByMediaItem(mediaItemId);
  return instances.map((inst) => ({
    id: inst.id,
    sourcePath: row.source_path,
    bbox: [
      inst.bounding_box.x ?? 0,
      inst.bounding_box.y ?? 0,
      (inst.bounding_box.x ?? 0) + (inst.bounding_box.width ?? 0),
      (inst.bounding_box.y ?? 0) + (inst.bounding_box.height ?? 0),
    ],
    landmarks: inst.landmarks_5 ?? undefined,
  }));
}

export const faceEmbeddingDefinition: PipelineDefinition<FaceEmbeddingParams, FaceEmbeddingOutput> = {
  id: "face-embedding",
  displayName: "Compute face embeddings",
  concurrencyGroup: "gpu",
  validateParams: (params) => validateParams(params),
  run: async (ctx, params) => {
    const modelInfo = await getEmbeddingModelInfo();
    if (!modelInfo?.loaded) {
      throw new Error("ArcFace embedding model is not loaded");
    }

    const mediaIds = new Set<string>();
    if (params.mediaItemIds) {
      for (const id of params.mediaItemIds) mediaIds.add(id);
    }
    if (params.folderPath) {
      const db = getDesktopDatabase();
      const prefix = params.folderPath.replace(/[\\/]+$/, "");
      const rows = db
        .prepare(
          `SELECT id, source_path
           FROM media_items
           WHERE library_id = ?
             AND deleted_at IS NULL
             AND (source_path = ? OR source_path LIKE ? || '%' OR source_path LIKE ? || '%')`,
        )
        .all(DEFAULT_LIBRARY_ID, prefix, prefix + "/", prefix + "\\") as Array<{
        id: string;
        source_path: string;
      }>;
      if (params.recursive === false) {
        for (const row of rows) {
          const rest = row.source_path.slice(prefix.length).replace(/^[\\/]+/, "");
          if (!/[\\/]/.test(rest)) {
            mediaIds.add(row.id);
          }
        }
      } else {
        for (const row of rows) mediaIds.add(row.id);
      }
    }

    const faces = Array.from(mediaIds).flatMap((id) => collectFacesForMediaItem(id));
    const groups = new Map<string, EmbeddableFace[]>();
    for (const face of faces) {
      const bucket = groups.get(face.sourcePath);
      if (bucket) bucket.push(face);
      else groups.set(face.sourcePath, [face]);
    }
    const grouped = Array.from(groups.entries());

    let embedded = 0;
    let failed = 0;
    let cancelled = 0;

    ctx.report({
      type: "started",
      total: faces.length,
      message: `Embedding ${faces.length} detected faces`,
    });
    ctx.report({
      type: "phase-changed",
      phase: "embedding",
      processed: 0,
      total: faces.length,
    });

    for (const [sourcePath, groupFaces] of grouped) {
      if (ctx.signal.aborted) {
        cancelled += groupFaces.length;
        break;
      }
      for (const face of groupFaces) {
        markFaceEmbeddingStatus(face.id, "indexing");
      }
      const facesForApi: FaceForEmbedding[] = groupFaces.map((face) => ({
        bbox_xyxy: face.bbox,
        landmarks_5: face.landmarks,
      }));
      try {
        const result = await generateFaceEmbeddings({
          imagePath: sourcePath,
          faces: facesForApi,
          signal: ctx.signal,
        });
        for (let i = 0; i < groupFaces.length; i++) {
          const face = groupFaces[i]!;
          const embedding = result.embeddings.find((entry) => entry.face_index === i);
          if (embedding) {
            upsertFaceEmbedding(face.id, embedding.vector, result.modelName, embedding.dimension);
            embedded += 1;
          } else {
            markFaceEmbeddingStatus(face.id, "failed");
            failed += 1;
          }
        }
      } catch {
        for (const face of groupFaces) {
          markFaceEmbeddingStatus(face.id, "failed");
          failed += 1;
        }
      }
      ctx.report({
        type: "item-updated",
        processed: embedded + failed + cancelled,
        total: faces.length,
        message: `Embedded faces in ${sourcePath}`,
      });
    }

    return {
      totalFaces: faces.length,
      embedded,
      failed,
      cancelled,
    };
  },
};


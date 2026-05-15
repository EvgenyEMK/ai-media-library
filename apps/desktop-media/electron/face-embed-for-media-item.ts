import type { FaceDetectionOutput } from "../src/shared/ipc";
import { listFaceInstancesByMediaItem } from "./db/face-tags";
import { markFaceEmbeddingStatus, upsertFaceEmbedding } from "./db/face-embeddings";
import {
  generateFaceEmbeddings,
  getEmbeddingModelInfo,
  type EmbeddingModelInfo,
  type FaceForEmbedding,
} from "./face-embedding";
import { transformFaceForRotatedEmbedding } from "./face-embedding-rotation";
import { createRotatedTempImage } from "./photo-analysis";

export interface FaceEmbeddingSummary {
  attempted: number;
  embedded: number;
  failed: number;
  cancelled: number;
}

export async function ensureFaceEmbeddingModelLoaded(): Promise<EmbeddingModelInfo> {
  const modelInfo = await getEmbeddingModelInfo();
  if (!modelInfo?.loaded) {
    const message = "ArcFace embedding model is not loaded.";
    console.error(`[face-embedding] ${message}`);
    throw new Error(message);
  }
  return modelInfo;
}

export async function embedFacesForMediaItem(params: {
  mediaItemId: string;
  imagePath: string;
  signal?: AbortSignal;
  preferredRotationClockwise?: 0 | 90 | 180 | 270;
  embeddingOverride?: { imagePath: string; faces: FaceDetectionOutput; cleanup?: () => Promise<void> };
  requireLoadedModel?: boolean;
}): Promise<FaceEmbeddingSummary> {
  const instances = listFaceInstancesByMediaItem(params.mediaItemId);
  if (instances.length === 0) return emptySummary();

  if (params.requireLoadedModel) {
    await ensureFaceEmbeddingModelLoaded();
  } else {
    const modelInfo = await getEmbeddingModelInfo();
    if (!modelInfo?.loaded) return emptySummary();
  }

  let cleanupRotatedImage: (() => Promise<void>) | null = null;
  const facesForEmbed: FaceForEmbedding[] = [];
  const embeddableInstances: typeof instances = [];

  try {
    let embeddingImagePath = params.embeddingOverride?.imagePath ?? params.imagePath;
    cleanupRotatedImage = params.embeddingOverride?.cleanup ?? null;
    const rotationAngle =
      params.preferredRotationClockwise === 90 ||
      params.preferredRotationClockwise === 180 ||
      params.preferredRotationClockwise === 270
        ? params.preferredRotationClockwise
        : null;

    if (!cleanupRotatedImage && rotationAngle !== null) {
      const rotated = await createRotatedTempImage(params.imagePath, rotationAngle);
      embeddingImagePath = rotated.path;
      cleanupRotatedImage = rotated.cleanup;
    }

    for (let idx = 0; idx < instances.length; idx++) {
      const inst = instances[idx]!;
      const overrideFace = params.embeddingOverride?.faces.faces[idx];
      const sourceBox = [
        inst.bounding_box.x ?? 0,
        inst.bounding_box.y ?? 0,
        (inst.bounding_box.x ?? 0) + (inst.bounding_box.width ?? 0),
        (inst.bounding_box.y ?? 0) + (inst.bounding_box.height ?? 0),
      ] as [number, number, number, number];
      const transformed = overrideFace
        ? { bbox: overrideFace.bbox_xyxy, landmarks: overrideFace.landmarks_5 }
        : rotationAngle !== null && inst.ref_image_width && inst.ref_image_height
          ? transformFaceForRotatedEmbedding({
              bbox: sourceBox,
              landmarks: inst.landmarks_5 ?? null,
              angle: rotationAngle,
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

    if (facesForEmbed.length === 0) return emptySummary();

    for (const inst of embeddableInstances) {
      markFaceEmbeddingStatus(inst.id, "indexing");
    }

    const result = await generateFaceEmbeddings({
      imagePath: embeddingImagePath,
      faces: facesForEmbed,
      signal: params.signal,
    });

    let embedded = 0;
    let failed = 0;
    for (let i = 0; i < embeddableInstances.length; i++) {
      const inst = embeddableInstances[i]!;
      const embedding = result.embeddings.find((entry) => entry.face_index === i);
      if (embedding) {
        upsertFaceEmbedding(inst.id, embedding.vector, result.modelName, embedding.dimension);
        embedded += 1;
      } else {
        markFaceEmbeddingStatus(inst.id, "failed");
        failed += 1;
      }
    }
    return { attempted: embeddableInstances.length, embedded, failed, cancelled: 0 };
  } catch (error) {
    const cancelled = params.signal?.aborted === true;
    for (const inst of embeddableInstances) {
      markFaceEmbeddingStatus(inst.id, cancelled ? "pending" : "failed");
    }
    const message = error instanceof Error ? error.message : String(error);
    console.log(
      `[emk-face-debug][chain-embed] fail path=${params.imagePath} msg=${JSON.stringify(message)} cancelled=${cancelled}`,
    );
    return {
      attempted: embeddableInstances.length,
      embedded: 0,
      failed: cancelled ? 0 : embeddableInstances.length,
      cancelled: cancelled ? embeddableInstances.length : 0,
    };
  } finally {
    await cleanupRotatedImage?.();
  }
}

function emptySummary(): FaceEmbeddingSummary {
  return { attempted: 0, embedded: 0, failed: 0, cancelled: 0 };
}

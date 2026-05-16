import { greedyMatchBoxesByIou, type PixelXyxyBox } from "@emk/shared-contracts";
import type { FaceDetectionOutput } from "../src/shared/ipc";

export interface FaceInstanceBBox {
  id: string;
  bbox_x: number | null;
  bbox_y: number | null;
  bbox_width: number | null;
  bbox_height: number | null;
  embedding_status: string | null;
}

export interface FaceEmbeddingTarget {
  instance: FaceInstanceBBox;
  detectionFaceIndex: number | null;
}

export function faceInstanceNeedsEmbedding(embeddingStatus: string | null): boolean {
  if (embeddingStatus === "ready") {
    return false;
  }
  return true;
}

function instanceToXyxy(inst: FaceInstanceBBox): PixelXyxyBox | null {
  if (
    inst.bbox_x == null ||
    inst.bbox_y == null ||
    inst.bbox_width == null ||
    inst.bbox_height == null
  ) {
    return null;
  }
  return {
    x1: inst.bbox_x,
    y1: inst.bbox_y,
    x2: inst.bbox_x + inst.bbox_width,
    y2: inst.bbox_y + inst.bbox_height,
  };
}

/**
 * Pick face instances that still need embeddings and align them to the latest
 * detection faces (by bbox IoU) when an override detection payload is present.
 */
export function planFaceEmbeddingTargets(
  instances: FaceInstanceBBox[],
  detectionFaces?: FaceDetectionOutput["faces"],
  minIoU = 0.3,
): FaceEmbeddingTarget[] {
  const needing = instances.filter((inst) => faceInstanceNeedsEmbedding(inst.embedding_status));
  if (needing.length === 0) {
    return [];
  }

  if (!detectionFaces || detectionFaces.length === 0) {
    return needing.map((instance) => ({ instance, detectionFaceIndex: null }));
  }

  const newBoxes = detectionFaces
    .map((face, idx) => ({
      item: { idx },
      box: {
        x1: face.bbox_xyxy[0],
        y1: face.bbox_xyxy[1],
        x2: face.bbox_xyxy[2],
        y2: face.bbox_xyxy[3],
      } as PixelXyxyBox,
    }))
    .filter((entry) => entry.box.x2 > entry.box.x1 && entry.box.y2 > entry.box.y1);

  const oldBoxes = needing
    .map((instance, idx) => {
      const box = instanceToXyxy(instance);
      return box ? { item: { instance, idx }, box } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const matches = greedyMatchBoxesByIou(newBoxes, oldBoxes, minIoU);
  const detectionIndexByInstanceId = new Map<string, number>();

  for (const [newIndex, match] of matches.entries()) {
    const instance = oldBoxes[match.oldIndex]?.item.instance;
    if (instance) {
      detectionIndexByInstanceId.set(instance.id, newIndex);
    }
  }

  return needing.map((instance) => ({
    instance,
    detectionFaceIndex: detectionIndexByInstanceId.get(instance.id) ?? null,
  }));
}

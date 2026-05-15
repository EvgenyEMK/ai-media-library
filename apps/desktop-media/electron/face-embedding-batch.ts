import {
  type FaceForEmbeddingJob,
  markFaceEmbeddingStatus,
  upsertFaceEmbedding,
} from "./db/face-embeddings";
import { generateFaceEmbeddings, type FaceForEmbedding } from "./face-embedding";

export interface FaceEmbeddingBatchSummary {
  totalFaces: number;
  embedded: number;
  failed: number;
  cancelled: number;
}

export async function embedFaceEmbeddingJobsByImage(
  faces: FaceForEmbeddingJob[],
  signal?: AbortSignal,
): Promise<FaceEmbeddingBatchSummary> {
  const grouped = new Map<string, FaceForEmbeddingJob[]>();
  for (const face of faces) {
    const group = grouped.get(face.sourcePath);
    if (group) {
      group.push(face);
    } else {
      grouped.set(face.sourcePath, [face]);
    }
  }

  let embedded = 0;
  let failed = 0;
  let cancelled = 0;

  for (const [sourcePath, groupFaces] of grouped) {
    if (signal?.aborted) {
      cancelled += groupFaces.length;
      break;
    }

    for (const face of groupFaces) {
      markFaceEmbeddingStatus(face.faceInstanceId, "indexing");
    }

    try {
      const result = await generateFaceEmbeddings({
        imagePath: sourcePath,
        faces: groupFaces.map(faceForEmbeddingJobToApiFace),
        signal,
      });

      for (let i = 0; i < groupFaces.length; i++) {
        const face = groupFaces[i]!;
        const embedding = result.embeddings.find((entry) => entry.face_index === i);
        if (embedding) {
          upsertFaceEmbedding(
            face.faceInstanceId,
            embedding.vector,
            result.modelName,
            embedding.dimension,
          );
          embedded += 1;
        } else {
          markFaceEmbeddingStatus(face.faceInstanceId, "failed");
          failed += 1;
        }
      }
    } catch {
      if (signal?.aborted) {
        cancelled += groupFaces.length;
        for (const face of groupFaces) {
          markFaceEmbeddingStatus(face.faceInstanceId, "pending");
        }
      } else {
        failed += groupFaces.length;
        for (const face of groupFaces) {
          markFaceEmbeddingStatus(face.faceInstanceId, "failed");
        }
      }
    }
  }

  return { totalFaces: faces.length, embedded, failed, cancelled };
}

function faceForEmbeddingJobToApiFace(face: FaceForEmbeddingJob): FaceForEmbedding {
  return {
    bbox_xyxy: [
      face.bbox_x,
      face.bbox_y,
      face.bbox_x + face.bbox_width,
      face.bbox_y + face.bbox_height,
    ] as [number, number, number, number],
    landmarks_5: parseLandmarks(face.landmarks_json),
  };
}

function parseLandmarks(value: string): Array<[number, number]> | undefined {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 5) return undefined;
    if (
      parsed.every(
        (item) =>
          Array.isArray(item) &&
          item.length === 2 &&
          typeof item[0] === "number" &&
          typeof item[1] === "number",
      )
    ) {
      return parsed as Array<[number, number]>;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

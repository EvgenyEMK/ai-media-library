import { embedFacesNative, getNativeEmbeddingModelInfo } from "./native-face/arcface-embedder";

export interface FaceForEmbedding {
  bbox_xyxy: [number, number, number, number];
  landmarks_5?: Array<[number, number]>;
  /** Optional known correction angle (clockwise) for the source image. */
  preferredRotationClockwise?: 0 | 90 | 180 | 270;
}

export interface FaceEmbeddingResult {
  face_index: number;
  vector: number[];
  dimension: number;
}

export interface EmbeddingModelInfo {
  modelName: string;
  dimension: number;
  loaded: boolean;
}

export async function generateFaceEmbeddings({
  imagePath,
  faces,
  signal,
}: {
  imagePath: string;
  faces: FaceForEmbedding[];
  signal?: AbortSignal;
}): Promise<{
  embeddings: FaceEmbeddingResult[];
  modelName: string;
  dimension: number;
}> {
  return embedFacesNative({ imagePath, faces, signal });
}

export async function getEmbeddingModelInfo(): Promise<EmbeddingModelInfo | null> {
  return getNativeEmbeddingModelInfo();
}

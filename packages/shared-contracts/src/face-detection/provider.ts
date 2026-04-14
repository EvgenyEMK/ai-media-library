/**
 * Face detection provider adapter — abstracts face detection across providers.
 *
 * Desktop implementation: RetinaFace Python sidecar.
 * Web implementation: Azure Face API, Google Vision, MediaPipe local.
 *
 * Provider-specific result types (Azure attributes, Google landmarks, etc.)
 * should be stored in the `providerPayload` field.
 */

import type { CanonicalBoundingBox, StoredBoundingBoxFormat } from "./bounding-box";

export type FaceDetectionProviderId = string;

export interface FaceDetectionProviderCapabilities {
  boundingBoxes: boolean;
  landmarks?: boolean;
  attributes?: boolean;
  embeddings?: boolean;
}

export interface FaceDetectionProviderRequest {
  imageUrl?: string;
  imageBytes?: ArrayBuffer | Uint8Array;
  imageSize?: { width: number; height: number } | null;
  correlationId?: string;
}

export interface DetectedFaceResult {
  boundingBox: CanonicalBoundingBox;
  rawProviderBoundingBox?: Partial<CanonicalBoundingBox> | null;
  rawProviderBoundingBoxFormat?: StoredBoundingBoxFormat | null;
  confidence?: number | null;
  embeddingVector?: number[] | null;
  providerPayload?: Record<string, unknown>;
}

export interface FaceDetectionProviderResponse {
  faces: DetectedFaceResult[];
  providerId: FaceDetectionProviderId;
  modelVersion?: string;
  warnings?: string[];
}

export interface FaceDetectionProviderAdapter {
  providerId: FaceDetectionProviderId;
  displayName: string;
  capabilities: FaceDetectionProviderCapabilities;
  detect(
    request: FaceDetectionProviderRequest,
    signal?: AbortSignal,
  ): Promise<FaceDetectionProviderResponse>;
}

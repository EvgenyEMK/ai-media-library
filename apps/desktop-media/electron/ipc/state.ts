import type {
  RunningAnalysisJob,
  RunningFaceDetectionJobContext,
  RunningImageRotationJob,
  RunningMetadataScanJob,
  RunningPathAnalysisJob,
  RunningSemanticIndexJob,
} from "./types";
import { SQLiteVectorStoreAdapter } from "../db/vector-store";
import { MULTIMODAL_EMBED_MODEL } from "../semantic-embeddings";

export const DEFAULT_CONCURRENCY = 2;
export const MAX_CONCURRENCY = 4;

export const runningJobs = new Map<string, RunningAnalysisJob>();

/** Face grouping ("Find groups") job cancellation flags. */
export const runningFaceClusteringJobs = new Map<string, { cancelled: boolean }>();
export const runningFaceDetectionJobs = new Map<string, RunningFaceDetectionJobContext>();
export const analyzedPhotosByFolder = new Map<string, Set<string>>();
export const detectedFacesByFolder = new Map<string, Set<string>>();
export const runningMetadataScanJobs = new Map<string, RunningMetadataScanJob>();
export const runningPathAnalysisJobs = new Map<string, RunningPathAnalysisJob>();
export const runningImageRotationJobs = new Map<string, RunningImageRotationJob>();
export const vectorStore = new SQLiteVectorStoreAdapter();

export const semanticIndexJobRef = {
  current: null as RunningSemanticIndexJob | null,
};

export const semanticEmbeddingStatusRef = {
  current: {
    model: MULTIMODAL_EMBED_MODEL,
    textEmbeddingReady: false,
    visionModelReady: false,
    lastProbeError: null as string | null,
  },
};

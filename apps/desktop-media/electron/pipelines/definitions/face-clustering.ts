import type { PipelineDefinition } from "../pipeline-registry";
import { runClusterUntaggedFacesJob } from "../../face-clustering";
import { getFaceRecognitionSimilarityThreshold } from "../../face-recognition-threshold";
import { refreshAllSuggestionsWithProgress } from "../../db/person-suggestions";

export interface FaceClusteringParams {
  similarityThreshold?: number;
  minClusterSize?: number;
  refreshSuggestions?: boolean;
}

export interface FaceClusteringOutput {
  status: "completed" | "cancelled" | "empty";
  clusterCount: number;
  suggestionsRefreshed?: number;
}

export const faceClusteringDefinition: PipelineDefinition<FaceClusteringParams, FaceClusteringOutput> =
  {
    id: "face-clustering",
    displayName: "Group faces by similarity",
    concurrencyGroup: "cpu",
    run: async (ctx, params) => {
      const result = await runClusterUntaggedFacesJob({
        similarityThreshold: params.similarityThreshold,
        minClusterSize: params.minClusterSize,
        shouldCancel: () => ctx.signal.aborted,
        onFacesLoaded: (totalFaces) => {
          ctx.report({
            type: "started",
            total: totalFaces,
            message: `Loaded ${totalFaces} untagged faces for clustering`,
          });
        },
        onProgress: (payload) => {
          ctx.report({
            type: "phase-changed",
            phase: payload.phase,
            processed: payload.processed,
            total: payload.total,
          });
        },
      });

      if (result.status !== "completed" || params.refreshSuggestions === false) {
        return result;
      }

      const threshold = await getFaceRecognitionSimilarityThreshold();
      const suggestionRefresh = refreshAllSuggestionsWithProgress(
        { threshold },
        ({ processedTags, totalTags }) => {
          ctx.report({
            type: "phase-changed",
            phase: "refreshing-suggestions",
            processed: processedTags,
            total: totalTags,
          });
        },
      );
      return {
        ...result,
        suggestionsRefreshed: suggestionRefresh.totalSuggestions,
      };
    },
  };


import type { PipelineDefinition } from "../pipeline-registry";
import { countSimilarUntaggedFacesForPerson } from "../../db/face-embeddings";
import { getFaceRecognitionSimilarityThreshold } from "../../face-recognition-threshold";

export interface SimilarUntaggedCountsParams {
  tagIds: string[];
  threshold?: number;
}

export interface SimilarUntaggedCountsOutput {
  counts: Record<string, number>;
  processed: number;
  cancelled: boolean;
}

function validateParams(params: unknown):
  | { ok: true; value: SimilarUntaggedCountsParams }
  | { ok: false; issues: string } {
  if (typeof params !== "object" || params === null) {
    return { ok: false, issues: "params must be an object" };
  }
  const candidate = params as Record<string, unknown>;
  if (!Array.isArray(candidate.tagIds)) {
    return { ok: false, issues: "tagIds is required" };
  }
  const tagIds = Array.from(
    new Set(
      candidate.tagIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    ),
  );
  if (tagIds.length === 0) {
    return { ok: false, issues: "tagIds cannot be empty" };
  }
  const threshold =
    typeof candidate.threshold === "number" && Number.isFinite(candidate.threshold)
      ? candidate.threshold
      : undefined;
  return { ok: true, value: { tagIds, threshold } };
}

export const similarUntaggedCountsDefinition: PipelineDefinition<
  SimilarUntaggedCountsParams,
  SimilarUntaggedCountsOutput
> = {
  id: "similar-untagged-counts",
  displayName: "Count similar untagged faces",
  concurrencyGroup: "cpu",
  validateParams: (params) => validateParams(params),
  run: async (ctx, params) => {
    const threshold = params.threshold ?? (await getFaceRecognitionSimilarityThreshold());
    const counts: Record<string, number> = {};
    let processed = 0;
    let cancelled = false;

    ctx.report({
      type: "started",
      total: params.tagIds.length,
      message: `Computing similar-face counts for ${params.tagIds.length} people`,
    });

    for (let i = 0; i < params.tagIds.length; i++) {
      if (ctx.signal.aborted) {
        cancelled = true;
        break;
      }
      const tagId = params.tagIds[i]!;
      counts[tagId] = countSimilarUntaggedFacesForPerson(tagId, { threshold });
      processed += 1;
      ctx.report({
        type: "item-updated",
        processed,
        total: params.tagIds.length,
        message: `Computed ${processed}/${params.tagIds.length}`,
        details: { counts: { ...counts } },
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
    }

    return { counts, processed, cancelled };
  },
};


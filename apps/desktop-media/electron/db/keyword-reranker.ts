/**
 * Re-ranks initial search results by measuring how many LLM-extracted
 * keywords match each image via **VLM** and/or **AI description** embeddings.
 *
 * The caller passes lookups for cached image + description vectors
 * (populated during the first-round search) so no extra DB reads are needed.
 */

import { DEFAULT_AI_IMAGE_SEARCH_SETTINGS } from "../../src/shared/ipc";
import { embedTextDirect } from "../nomic-vision-embedder";
import type { SemanticSearchRow } from "./semantic-search";

export interface KeywordReRankOptions {
  /**
   * Min cosine between keyword embedding and the image **VLM** embedding for a "hit" on that modality.
   * **0** means this modality does not count toward keyword hits. Default from AI image search settings.
   */
  vlmThreshold?: number;
  /**
   * Min cosine between keyword embedding and the **AI description** embedding for a "hit" on that modality.
   * **0** disables the description limb. Default from AI image search settings.
   */
  descriptionThreshold?: number;
  /** Which signals count toward keyword hits (default hybrid = either modality). */
  hitSignalMode?: "hybrid" | "hybrid-max" | "vlm-only" | "description-only";
}

export interface ReRankedRow extends SemanticSearchRow {
  keywordCoverage: number;
  keywordHits: number;
  /** Similarity score credited for each keyword hit (VLM-only, desc-only, or max of both), in keyword order. */
  keywordHitScores: number[];
}

/**
 * Re-rank results by keyword coverage.
 *
 * For each result that has a cached description vector, compute cosine
 * similarity against every keyword embedding. Images matching more
 * keywords get a multiplicative score boost.
 *
 * Images with neither VLM nor description cache entry keep their original score and get zero keyword hits.
 *
 * A keyword counts as a **hit** if either active modality passes its threshold (OR in hybrid).
 * A modality is inactive when its threshold is **0**.
 *
 * Final order: **more keyword hits first**; within the same hit count, **higher RRF score** first
 * (`score` is left unchanged from the fused ordering step).
 */
export async function reRankByKeywordCoverage(
  results: SemanticSearchRow[],
  keywords: string[],
  getVlmVector: (mediaItemId: string) => Float32Array | undefined,
  getDescVector: (mediaItemId: string) => Float32Array | undefined,
  options: KeywordReRankOptions = {},
): Promise<ReRankedRow[]> {
  const {
    vlmThreshold = DEFAULT_AI_IMAGE_SEARCH_SETTINGS.keywordMatchThresholdVlm,
    descriptionThreshold = DEFAULT_AI_IMAGE_SEARCH_SETTINGS.keywordMatchThresholdDescription,
    hitSignalMode = "hybrid",
  } = options;

  if (keywords.length === 0) {
    return results.map((r) => ({
      ...r,
      keywordCoverage: 0,
      keywordHits: 0,
      keywordHitScores: [],
    }));
  }

  const keywordVectors = await Promise.all(
    keywords.map(async (kw) => {
      const vec = await embedTextDirect(kw);
      return new Float32Array(vec);
    }),
  );

  const reRanked: ReRankedRow[] = results.map((r) => {
    const vlmVec = getVlmVector(r.mediaItemId);
    const descVec = getDescVector(r.mediaItemId);
    if (!vlmVec && !descVec) {
      return { ...r, keywordCoverage: 0, keywordHits: 0, keywordHitScores: [] };
    }

    let coverageSum = 0;
    let hits = 0;
    const keywordHitScores: number[] = [];
    for (const kwVec of keywordVectors) {
      let vlmSim: number | undefined;
      if (vlmVec) {
        vlmSim = cosineSimilarityTyped(kwVec, vlmVec);
      }
      let descSim: number | undefined;
      if (descVec) {
        descSim = cosineSimilarityTyped(kwVec, descVec);
      }
      const vlmHit =
        vlmThreshold > 0 && vlmSim !== undefined && vlmSim >= vlmThreshold;
      const descHit =
        descriptionThreshold > 0 &&
        descSim !== undefined &&
        descSim >= descriptionThreshold;
      const keywordHit =
        hitSignalMode === "hybrid" || hitSignalMode === "hybrid-max"
          ? vlmHit || descHit
          : hitSignalMode === "vlm-only"
            ? vlmHit
            : descHit;
      if (keywordHit) {
        hits += 1;
        let credited: number;
        if (hitSignalMode === "vlm-only") {
          credited = vlmSim ?? 0;
        } else if (hitSignalMode === "description-only") {
          credited = descSim ?? 0;
        } else if (vlmHit && descHit) {
          credited = Math.max(vlmSim!, descSim!);
        } else if (vlmHit) {
          credited = vlmSim!;
        } else {
          credited = descSim!;
        }
        coverageSum += credited;
        keywordHitScores.push(credited);
      }
    }

    const coverage = coverageSum / keywords.length;

    return {
      ...r,
      keywordCoverage: coverage,
      keywordHits: hits,
      keywordHitScores,
    };
  });

  reRanked.sort(compareKeywordRerankRowsImpl);

  let noVlmVec = 0;
  let noDescVec = 0;
  let noEitherVec = 0;
  let zeroHits = 0;
  for (const r of reRanked) {
    if (getVlmVector(r.mediaItemId) === undefined) noVlmVec++;
    if (getDescVector(r.mediaItemId) === undefined) noDescVec++;
    if (
      getVlmVector(r.mediaItemId) === undefined &&
      getDescVector(r.mediaItemId) === undefined
    ) {
      noEitherVec++;
    }
    if (r.keywordHits === 0) zeroHits++;
  }
  const top = reRanked[0];
  let topPerKwSims = "";
  if (top && (getVlmVector(top.mediaItemId) || getDescVector(top.mediaItemId))) {
    topPerKwSims = keywords
      .map((kw, i) => {
        const parts: string[] = [];
        const iv = getVlmVector(top.mediaItemId);
        if (iv) {
          parts.push(
            `vlm:${cosineSimilarityTyped(keywordVectors[i], iv).toFixed(3)}`,
          );
        }
        const dv = getDescVector(top.mediaItemId);
        if (dv) {
          parts.push(
            `desc:${cosineSimilarityTyped(keywordVectors[i], dv).toFixed(3)}`,
          );
        }
        return `${JSON.stringify(kw)}:[${parts.join(" ")}]`;
      })
      .join(", ");
  }
  console.log(
    `[keyword-rerank] vlmTh=${vlmThreshold} descTh=${descriptionThreshold} tie=RRF_score | rows=${results.length} noVlmEmbedding=${noVlmVec} noDescEmbedding=${noDescVec} noEitherEmbedding=${noEitherVec} zeroKeywordHits=${zeroHits} | top-result per-keyword cos: [${topPerKwSims}]`,
  );

  return reRanked;
}

/** Sort: keyword hits desc, then RRF score desc. Exported for unit tests. */
export function compareKeywordRerankRows(
  a: Pick<ReRankedRow, "keywordHits" | "score">,
  b: Pick<ReRankedRow, "keywordHits" | "score">,
): number {
  const hitDiff = b.keywordHits - a.keywordHits;
  if (hitDiff !== 0) return hitDiff;
  return b.score - a.score;
}

function compareKeywordRerankRowsImpl(a: ReRankedRow, b: ReRankedRow): number {
  return compareKeywordRerankRows(a, b);
}

function cosineSimilarityTyped(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}

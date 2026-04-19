/**
 * Reciprocal Rank Fusion (RRF) — merges multiple ranked result lists into a
 * single ranked list.  Items appearing in more than one list receive a higher
 * combined score, which naturally pushes results that match multiple signals
 * (e.g. vision similarity AND caption-text similarity) toward the top.
 *
 * Formula:  RRF_score(item) = SUM over lists L of  1 / (k + rank_L(item))
 *
 * `k` is a smoothing constant (default 60 per the original RRF paper).
 */

export interface RankedItem {
  mediaItemId: string;
  /** 1-based rank within the originating list. */
  rank: number;
}

export interface FusedResult {
  mediaItemId: string;
  rrfScore: number;
}

/**
 * Fuses N pre-sorted ranked lists using Reciprocal Rank Fusion.
 *
 * @param rankedLists - Each inner array must already be sorted by its own
 *                      relevance metric (best first) with 1-based rank values.
 * @param k           - Smoothing constant (default 60).
 * @param limit       - Maximum number of results to return.
 */
export function fuseWithRRF(
  rankedLists: RankedItem[][],
  k = 60,
  limit = 50,
): FusedResult[] {
  const scores = new Map<string, number>();

  for (const list of rankedLists) {
    for (const item of list) {
      const prev = scores.get(item.mediaItemId) ?? 0;
      scores.set(item.mediaItemId, prev + 1 / (k + item.rank));
    }
  }

  const fused: FusedResult[] = [];
  for (const [mediaItemId, rrfScore] of scores) {
    fused.push({ mediaItemId, rrfScore });
  }

  fused.sort((a, b) => b.rrfScore - a.rrfScore);
  return fused.slice(0, limit);
}

/**
 * Converts a raw score-sorted array into RankedItem[] with 1-based ranks,
 * ready for RRF fusion.
 */
export function toRankedList(
  items: Array<{ mediaItemId: string }>,
): RankedItem[] {
  return items.map((item, index) => ({
    mediaItemId: item.mediaItemId,
    rank: index + 1,
  }));
}

export interface MaxCosineFusedResult {
  mediaItemId: string;
  /** `max(vlmCosine, descCosine)` when both exist; otherwise the available cosine. */
  fusedScore: number;
}

/**
 * Merges VLM and description vector hits by **raw cosine** using the best of both:
 * each item gets `max(vlmScore, descScore)` when both exist, otherwise the single score.
 * Unlike RRF, this does not boost items that rank on both lists—useful when many items
 * lack a description embedding.
 */
export function fuseMaxCosineSimilarity(
  vectorRows: Array<{ mediaItemId: string; score: number }>,
  descriptionRows: Array<{ mediaItemId: string; score: number }>,
  limit: number,
): MaxCosineFusedResult[] {
  const byId = new Map<string, { vlm?: number; desc?: number }>();
  for (const r of vectorRows) {
    byId.set(r.mediaItemId, { vlm: r.score });
  }
  for (const r of descriptionRows) {
    const prev = byId.get(r.mediaItemId);
    if (prev) {
      byId.set(r.mediaItemId, { ...prev, desc: r.score });
    } else {
      byId.set(r.mediaItemId, { desc: r.score });
    }
  }

  const fused: MaxCosineFusedResult[] = [];
  for (const [mediaItemId, s] of byId) {
    const { vlm, desc } = s;
    let fusedScore: number;
    if (vlm !== undefined && desc !== undefined) {
      fusedScore = Math.max(vlm, desc);
    } else if (vlm !== undefined) {
      fusedScore = vlm;
    } else if (desc !== undefined) {
      fusedScore = desc;
    } else {
      continue;
    }
    fused.push({ mediaItemId, fusedScore });
  }

  fused.sort((a, b) => b.fusedScore - a.fusedScore);
  return fused.slice(0, Math.max(0, limit));
}

export interface SimilarImagesActions {
  openSimilarImagesView(params: { sourcePath: string; minSimilarity?: number }): void;
}

export function createSimilarImagesActions(opts: {
  openView: (params: { sourcePath: string; minSimilarity: number }) => void;
}): SimilarImagesActions {
  return {
    openSimilarImagesView(params: { sourcePath: string; minSimilarity?: number }): void {
      opts.openView({
        sourcePath: params.sourcePath,
        minSimilarity: params.minSimilarity ?? 0.9,
      });
    },
  };
}

/**
 * Folders that contain at least one direct image/video file on disk (same notion as the quick-scan
 * walk’s `folderMediaLines`). Parent directories that only contain subfolders are excluded — they
 * never receive `metadata_scanned_at` from the metadata scan pipeline, so they must not count as
 * “missing full scan” in coverage math.
 */
export function listFolderPathsWithDirectMediaOnDisk(
  allFolderPaths: readonly string[],
  folderMediaLines: ReadonlyMap<string, readonly string[]>,
): string[] {
  return allFolderPaths.filter((fp) => (folderMediaLines.get(fp) ?? []).length > 0);
}

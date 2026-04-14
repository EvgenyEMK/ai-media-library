import type { DesktopStore } from "../stores/desktop-store";

const pendingRefreshPaths = new Set<string>();
let refreshTimer: number | null = null;

export function queueMetadataRefresh(store: DesktopStore, filePath: string): void {
  pendingRefreshPaths.add(filePath);
  if (refreshTimer !== null) return;
  refreshTimer = window.setTimeout(() => {
    const paths = Array.from(pendingRefreshPaths);
    pendingRefreshPaths.clear();
    refreshTimer = null;
    if (paths.length === 0) return;
    void window.desktopApi
      .getMediaItemsByPaths(paths)
      .then((metadataByPath) => {
        store.setState((s) => {
          s.mediaMetadataByItemId = { ...s.mediaMetadataByItemId, ...metadataByPath };
        });
      })
      .catch(() => undefined);
  }, 250);
}

export function clearPendingRefreshTimers(): void {
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  pendingRefreshPaths.clear();
}

export async function refreshFolderAiRollups(store: DesktopStore): Promise<void> {
  const s = store.getState();
  const paths = new Set<string>(s.libraryRoots);
  for (const expandedPath of s.expandedFolders) {
    paths.add(expandedPath);
    for (const child of s.childrenByPath[expandedPath] ?? []) {
      paths.add(child.path);
    }
  }
  const list = [...paths].filter(Boolean);
  if (list.length === 0) {
    return;
  }
  try {
    const rollups = await window.desktopApi.getFolderAiRollupsBatch(list);
    store.setState((st) => {
      for (const [folderPath, rollup] of Object.entries(rollups)) {
        st.folderRollupByPath[folderPath] = rollup;
      }
    });
  } catch {
    // ignore
  }
}

export async function refreshFolderAnalysisStatuses(store: DesktopStore): Promise<void> {
  try {
    const statuses = await window.desktopApi.getFolderAnalysisStatuses();
    store.setState((s) => {
      s.folderAnalysisByPath = statuses;
    });
  } catch {
    // ignore
  }
  await refreshFolderAiRollups(store);
}

export async function refreshMetadataForItems(
  store: DesktopStore,
  items: Array<{ id: string }>,
): Promise<void> {
  const paths = items.map((i) => i.id);
  try {
    const metadata = await window.desktopApi.getMediaItemsByPaths(paths);
    store.setState((s) => {
      s.mediaMetadataByItemId = { ...s.mediaMetadataByItemId, ...metadata };
    });
  } catch {
    // Keep existing cache; replacing the whole map dropped unrelated paths and broke viewer face tags.
  }
}

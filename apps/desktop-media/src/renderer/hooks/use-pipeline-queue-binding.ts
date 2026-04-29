import { useEffect } from "react";
import { useDesktopStoreApi } from "../stores/desktop-store";

/**
 * Subscribes the renderer-side `pipelineQueueSlice` to the central
 * orchestration channels exposed via `window.desktopApi.pipelines`. Mounts a
 * single hook from `App.tsx` (sibling to the legacy `useDesktopIpcBindings`).
 *
 * On mount, also primes the store with a one-shot `getSnapshot()` call so the
 * dock has data before the next push event arrives (same pattern that
 * `useDesktopIpcBindings` uses for `getActiveJobStatuses`).
 */
export function usePipelineQueueBinding(): void {
  const store = useDesktopStoreApi();

  useEffect(() => {
    const api = window.desktopApi.pipelines;
    if (!api) return;

    void api
      .getSnapshot()
      .then((snapshot) => {
        store.getState().setPipelineQueueSnapshot(snapshot);
      })
      .catch((err: unknown) => {
        // Snapshot priming is best-effort; subsequent push events will hydrate.
        console.warn("[pipeline-queue] initial getSnapshot failed", err);
      });

    const offQueueChanged = api.onQueueChanged((snapshot) => {
      store.getState().setPipelineQueueSnapshot(snapshot);
    });
    const offJobProgress = api.onJobProgress(({ bundleId, jobId, progress }) => {
      store.getState().patchJobProgress(bundleId, jobId, progress);
    });
    const offLifecycle = api.onLifecycle((event) => {
      store.getState().appendPipelineLifecycle(event);
    });

    return () => {
      offQueueChanged();
      offJobProgress();
      offLifecycle();
    };
  }, [store]);
}

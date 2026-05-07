import { useEffect, useState } from "react";

/**
 * Playwright sets `EMK_E2E_RUN_PIPELINES_UI=1` in the main process; renderer reads via IPC.
 * Defaults false until loaded so production never flashes test-only controls.
 */
export function useShowRunPipelinesTestUi(): boolean {
  const [show, setShow] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    void window.desktopApi.getDesktopRuntimeFlags().then((flags) => {
      if (!cancelled) {
        setShow(flags.showRunPipelinesTestUi);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return show;
}

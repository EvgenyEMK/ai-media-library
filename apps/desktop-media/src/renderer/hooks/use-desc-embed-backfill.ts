import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { DescEmbedBackfillProgressEvent } from "../../shared/ipc";
import type { DescEmbedBackfillState } from "../components/DesktopProgressDock";

const INITIAL_DESC_EMBED_BACKFILL: DescEmbedBackfillState = {
  status: "idle",
  jobId: null,
  processed: 0,
  total: 0,
  indexed: 0,
  skipped: 0,
  failed: 0,
  error: null,
  panelVisible: false,
};

/** TEMPORARY: description embedding backfill — remove after migration */
export function useDescEmbedBackfill(
  setProgressPanelCollapsed: (collapsed: boolean) => void,
): {
  descEmbedBackfill: DescEmbedBackfillState;
  setDescEmbedBackfill: Dispatch<SetStateAction<DescEmbedBackfillState>>;
  handleIndexDescEmbeddings: (folderPath: string, recursive: boolean) => Promise<void>;
  handleCancelDescEmbedBackfill: () => Promise<void>;
} {
  const [descEmbedBackfill, setDescEmbedBackfill] = useState<DescEmbedBackfillState>(
    INITIAL_DESC_EMBED_BACKFILL,
  );
  const jobIdRef = useRef<string | null>(null);
  jobIdRef.current = descEmbedBackfill.jobId;

  useEffect(() => {
    const unsub = window.desktopApi.onDescEmbedBackfillProgress(
      (event: DescEmbedBackfillProgressEvent) => {
        switch (event.type) {
          case "started":
            setDescEmbedBackfill((prev) => ({
              ...prev,
              status: "running",
              jobId: event.jobId,
              total: event.total,
              processed: 0,
              indexed: 0,
              skipped: 0,
              failed: 0,
              error: null,
              panelVisible: true,
            }));
            setProgressPanelCollapsed(false);
            break;
          case "progress":
            setDescEmbedBackfill((prev) => ({
              ...prev,
              processed: event.processed,
              total: event.total,
              indexed: event.indexed,
              skipped: event.skipped,
              failed: event.failed,
            }));
            break;
          case "completed":
            setDescEmbedBackfill((prev) => ({
              ...prev,
              status: "completed",
              indexed: event.indexed,
              skipped: event.skipped,
              failed: event.failed,
              processed: event.indexed + event.skipped + event.failed,
            }));
            break;
          case "failed":
            setDescEmbedBackfill((prev) => ({
              ...prev,
              status: "failed",
              error: event.error,
            }));
            break;
          case "cancelled":
            setDescEmbedBackfill((prev) => ({
              ...prev,
              status: "cancelled",
            }));
            break;
        }
      },
    );
    return unsub;
  }, [setProgressPanelCollapsed]);

  const handleIndexDescEmbeddings = useCallback(
    async (folderPath: string, recursive: boolean): Promise<void> => {
      setDescEmbedBackfill((prev) => ({
        ...prev,
        status: "running",
        jobId: null,
        processed: 0,
        total: 0,
        indexed: 0,
        skipped: 0,
        failed: 0,
        error: null,
        panelVisible: true,
      }));
      setProgressPanelCollapsed(false);
      try {
        const result = await window.desktopApi.indexDescriptionEmbeddings({
          folderPath,
          recursive,
        });
        setDescEmbedBackfill((prev) => ({ ...prev, jobId: result.jobId }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Description embedding failed.";
        setDescEmbedBackfill((prev) => ({
          ...prev,
          status: "failed",
          error: message,
        }));
      }
    },
    [setProgressPanelCollapsed],
  );

  const handleCancelDescEmbedBackfill = useCallback(async (): Promise<void> => {
    const jobId = jobIdRef.current;
    if (!jobId) return;
    await window.desktopApi.cancelDescEmbedBackfill(jobId);
  }, []);

  return {
    descEmbedBackfill,
    setDescEmbedBackfill,
    handleIndexDescEmbeddings,
    handleCancelDescEmbedBackfill,
  };
}

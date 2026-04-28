import { useCallback, useState } from "react";
import type { ActiveJobStatuses } from "../../shared/ipc";
import { useDesktopStoreApi } from "../stores/desktop-store";
import type { SummaryPipelineKind } from "../types/folder-ai-summary-types";

interface UseFolderAiSummaryPipelineActionsParams {
  folderPath: string;
  onRunSemanticPipeline?: (folderPath: string, recursive: boolean, overrideExisting: boolean) => Promise<void> | void;
  onRunFacePipeline?: (folderPath: string, recursive: boolean, overrideExisting: boolean) => Promise<void> | void;
  onRunPhotoPipeline?: (folderPath: string, recursive: boolean, overrideExisting: boolean) => Promise<void> | void;
}

interface UseFolderAiSummaryPipelineActionsResult {
  actionPendingPipeline: SummaryPipelineKind | null;
  showPipelineBlockedDialog: boolean;
  setShowPipelineBlockedDialog: (visible: boolean) => void;
  runPipelineForFolderWithSubfolders: (pipeline: SummaryPipelineKind) => Promise<void>;
}

function hasAnyActiveAiPipeline(active: ActiveJobStatuses): boolean {
  return Boolean(active.photoAnalysis || active.faceDetection || active.semanticIndex);
}

export function useFolderAiSummaryPipelineActions({
  folderPath,
  onRunSemanticPipeline,
  onRunFacePipeline,
  onRunPhotoPipeline,
}: UseFolderAiSummaryPipelineActionsParams): UseFolderAiSummaryPipelineActionsResult {
  const store = useDesktopStoreApi();
  const [showPipelineBlockedDialog, setShowPipelineBlockedDialog] = useState(false);
  const [actionPendingPipeline, setActionPendingPipeline] = useState<SummaryPipelineKind | null>(null);

  const markPipelineStartingInUi = useCallback(
    (pipeline: SummaryPipelineKind): void => {
      store.setState((s) => {
        if (pipeline === "rotation") {
          s.imageRotationError = null;
          s.imageRotationStatus = "running";
          s.imageRotationPanelVisible = true;
          s.imageRotationJobId = null;
          s.imageRotationProcessed = 0;
          s.imageRotationTotal = 0;
          s.imageRotationWronglyRotated = 0;
          s.imageRotationSkipped = 0;
          s.imageRotationFailed = 0;
          s.imageRotationFolderPath = folderPath;
          return;
        }
        if (pipeline === "semantic") {
          s.semanticIndexError = null;
          s.semanticIndexStatus = "running";
          s.semanticIndexPanelVisible = true;
          s.semanticIndexJobId = null;
          s.semanticIndexItemOrder = [];
          s.semanticIndexItemsByKey = {};
          s.semanticIndexAverageSecondsPerFile = null;
          s.semanticIndexCurrentFolderPath = null;
          s.semanticIndexPhase = null;
        } else if (pipeline === "face") {
          s.faceError = null;
          s.faceStatus = "running";
          s.facePanelVisible = true;
          s.faceJobId = null;
          s.faceItemOrder = [];
          s.faceItemsByKey = {};
          s.faceAverageSecondsPerFile = null;
          s.faceCurrentFolderPath = null;
        } else {
          s.aiError = null;
          s.aiStatus = "running";
          s.aiPanelVisible = true;
          s.aiJobId = null;
          s.aiItemOrder = [];
          s.aiItemsByKey = {};
          s.aiAverageSecondsPerFile = null;
          s.aiCurrentFolderPath = null;
          s.aiPhase = null;
        }
      });
    },
    [folderPath, store],
  );

  const markPipelineStartFailedInUi = useCallback(
    (pipeline: SummaryPipelineKind, message: string): void => {
      store.setState((s) => {
        if (pipeline === "rotation") {
          s.imageRotationStatus = "failed";
          s.imageRotationError = message;
          s.imageRotationPanelVisible = true;
        } else if (pipeline === "semantic") {
          s.semanticIndexError = message;
          s.semanticIndexStatus = "failed";
          s.semanticIndexPhase = null;
        } else if (pipeline === "face") {
          s.faceError = message;
          s.faceStatus = "failed";
        } else {
          s.aiError = message;
          s.aiStatus = "failed";
          s.aiPhase = null;
        }
      });
    },
    [store],
  );

  const runPipelineForFolderWithSubfolders = useCallback(
    async (pipeline: SummaryPipelineKind): Promise<void> => {
      if (!folderPath || actionPendingPipeline) return;
      const liveState = store.getState();
      if (
        liveState.aiStatus === "running" ||
        liveState.faceStatus === "running" ||
        liveState.semanticIndexStatus === "running" ||
        liveState.imageRotationStatus === "running"
      ) {
        setShowPipelineBlockedDialog(true);
        return;
      }
      try {
        const activeJobs = await window.desktopApi.getActiveJobStatuses();
        if (hasAnyActiveAiPipeline(activeJobs)) {
          setShowPipelineBlockedDialog(true);
          return;
        }
      } catch {
        // Store state already protects common cases if this defensive check fails.
      }
      setActionPendingPipeline(pipeline);
      try {
        if (pipeline === "rotation") {
          markPipelineStartingInUi("rotation");
          const result = await window.desktopApi.detectFolderImageRotation({ folderPath, recursive: true });
          store.setState((s) => {
            s.imageRotationJobId = result.jobId;
            s.imageRotationTotal = result.total;
          });
          await new Promise<void>((resolve) => {
            const unsubscribe = window.desktopApi.onImageRotationProgress((event) => {
              if (event.jobId !== result.jobId) return;
              if (event.type === "job-completed" || event.type === "job-cancelled" || event.type === "job-failed") {
                unsubscribe();
                resolve();
              }
            });
          });
        } else if (pipeline === "semantic") {
          if (onRunSemanticPipeline) await onRunSemanticPipeline(folderPath, true, false);
          else {
            markPipelineStartingInUi("semantic");
            const result = await window.desktopApi.indexFolderSemanticEmbeddings({
              folderPath,
              recursive: true,
              mode: "missing",
            });
            store.setState((s) => {
              s.semanticIndexJobId = result.jobId;
            });
          }
        } else if (pipeline === "face") {
          if (onRunFacePipeline) await onRunFacePipeline(folderPath, true, false);
          else {
            markPipelineStartingInUi("face");
            const result = await window.desktopApi.detectFolderFaces({
              folderPath,
              recursive: true,
              mode: "missing",
            });
            store.setState((s) => {
              s.faceJobId = result.jobId;
            });
          }
        } else if (onRunPhotoPipeline) {
          await onRunPhotoPipeline(folderPath, true, false);
        } else {
          markPipelineStartingInUi("photo");
          const result = await window.desktopApi.analyzeFolderPhotos({
            folderPath,
            recursive: true,
            mode: "missing",
          });
          store.setState((s) => {
            s.aiJobId = result.jobId;
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not start pipeline.";
        markPipelineStartFailedInUi(pipeline, message);
      } finally {
        setActionPendingPipeline(null);
      }
    },
    [
      actionPendingPipeline,
      folderPath,
      markPipelineStartFailedInUi,
      markPipelineStartingInUi,
      onRunFacePipeline,
      onRunPhotoPipeline,
      onRunSemanticPipeline,
      store,
    ],
  );

  return {
    actionPendingPipeline,
    showPipelineBlockedDialog,
    setShowPipelineBlockedDialog,
    runPipelineForFolderWithSubfolders,
  };
}

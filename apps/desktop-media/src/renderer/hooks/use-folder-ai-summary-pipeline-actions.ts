import { useCallback, useState } from "react";
import { enqueueFolderAiPipeline } from "../lib/enqueue-folder-ai-pipeline";
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
  runPipelineForFolderWithSubfolders: (pipeline: SummaryPipelineKind) => Promise<void>;
}

export function useFolderAiSummaryPipelineActions({
  folderPath,
  onRunSemanticPipeline,
  onRunFacePipeline,
  onRunPhotoPipeline,
}: UseFolderAiSummaryPipelineActionsParams): UseFolderAiSummaryPipelineActionsResult {
  const store = useDesktopStoreApi();
  const [actionPendingPipeline, setActionPendingPipeline] = useState<SummaryPipelineKind | null>(null);

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
      setActionPendingPipeline(pipeline);
      try {
        if (pipeline === "rotation") {
          await enqueueFolderAiPipeline({ folderPath, pipeline: "rotation", recursive: true });
        } else if (pipeline === "semantic") {
          if (onRunSemanticPipeline) await onRunSemanticPipeline(folderPath, true, false);
          else await enqueueFolderAiPipeline({ folderPath, pipeline: "semantic", recursive: true });
        } else if (pipeline === "face") {
          if (onRunFacePipeline) await onRunFacePipeline(folderPath, true, false);
          else await enqueueFolderAiPipeline({ folderPath, pipeline: "face", recursive: true });
        } else if (onRunPhotoPipeline) {
          await onRunPhotoPipeline(folderPath, true, false);
        } else {
          await enqueueFolderAiPipeline({ folderPath, pipeline: "photo", recursive: true });
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
      onRunFacePipeline,
      onRunPhotoPipeline,
      onRunSemanticPipeline,
      store,
    ],
  );

  return {
    actionPendingPipeline,
    runPipelineForFolderWithSubfolders,
  };
}

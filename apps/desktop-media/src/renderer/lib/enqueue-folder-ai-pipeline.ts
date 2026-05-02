import type { AppSettings } from "../../shared/ipc";
import type { EnqueueBundleResponse } from "../../shared/pipeline-ipc";

export type FolderAiPipelineKind = "photo" | "face" | "semantic" | "rotation";

interface EnqueueFolderAiPipelineOptions {
  folderPath: string;
  pipeline: FolderAiPipelineKind;
  recursive?: boolean;
  overrideExisting?: boolean;
  photoModel?: string;
  photoThinkingEnabled?: boolean;
  photoSettings?: AppSettings["photoAnalysis"];
  faceDetectionSettings?: AppSettings["faceDetection"];
}

function displayNameForPipeline(pipeline: FolderAiPipelineKind, folderPath: string): string {
  if (pipeline === "photo") return `Photo analysis — ${folderPath}`;
  if (pipeline === "face") return `Face detection — ${folderPath}`;
  if (pipeline === "semantic") return `Semantic index — ${folderPath}`;
  return `Image rotation precheck — ${folderPath}`;
}

function rejectionMessage(result: EnqueueBundleResponse): string {
  if (result.ok) return "";
  const rejection = result.rejection;
  if (rejection.kind === "validation-failed") return rejection.issues;
  if (rejection.kind === "unknown-pipeline") return `Unknown pipeline: ${rejection.pipelineId}`;
  return rejection.reason;
}

export async function enqueueFolderAiPipeline(options: EnqueueFolderAiPipelineOptions): Promise<void> {
  const folderPath = options.folderPath.trim();
  if (!folderPath) throw new Error("Folder path is required.");

  const recursive = options.recursive !== false;
  const overrideExisting = options.overrideExisting === true;

  const payload =
    options.pipeline === "photo"
      ? {
          pipelineId: "photo-analysis" as const,
          displayName: displayNameForPipeline("photo", folderPath),
          params: {
            folderPath,
            recursive,
            mode: overrideExisting ? "all" : "missing",
            model: options.photoModel,
            think: options.photoThinkingEnabled,
            timeoutMsPerImage: options.photoSettings
              ? Math.max(10_000, Math.round(options.photoSettings.analysisTimeoutPerImageSec * 1000))
              : undefined,
            downscaleBeforeLlm: options.photoSettings?.downscaleBeforeLlm,
            downscaleLongestSidePx: options.photoSettings?.downscaleLongestSidePx,
            extractInvoiceData: options.photoSettings?.extractInvoiceData,
          },
        }
      : options.pipeline === "face"
        ? {
            pipelineId: "face-detection" as const,
            displayName: displayNameForPipeline("face", folderPath),
            params: {
              folderPath,
              recursive,
              mode: overrideExisting ? "all" : "missing",
              faceDetectionSettings: options.faceDetectionSettings,
            },
          }
        : options.pipeline === "semantic"
          ? {
              pipelineId: "semantic-index" as const,
              displayName: displayNameForPipeline("semantic", folderPath),
              params: {
                folderPath,
                recursive,
                mode: overrideExisting ? "all" : "missing",
              },
            }
          : {
              pipelineId: "image-rotation-precheck" as const,
              displayName: displayNameForPipeline("rotation", folderPath),
              params: {
                folderPath,
                recursive,
                force: overrideExisting,
              },
            };

  const result = await window.desktopApi.pipelines.enqueueBundle({
    kind: "single-job",
    payload,
  });
  if (!result.ok) {
    if (result.rejection.kind === "duplicate-active-job") return;
    throw new Error(rejectionMessage(result) || "Could not enqueue pipeline.");
  }
}

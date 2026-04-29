import { BrowserWindow, ipcMain } from "electron";
import {
  PIPELINE_IPC_CHANNELS,
  type EnqueueBundleRequest,
  type EnqueueBundleResponse,
  type JobProgressPushEvent,
} from "../../src/shared/pipeline-ipc";
import type {
  PipelineLifecycleEvent,
  PipelineQueueSnapshot,
} from "../../src/shared/pipeline-types";
import {
  pipelineScheduler,
  type BundleSpec,
} from "../pipelines/pipeline-scheduler";
import {
  pipelinePresetRegistry,
} from "../pipelines/preset-registry";

/**
 * Wires the {@link pipelineScheduler} singleton to Electron IPC.
 *
 * Responsibilities:
 *   - Translate `enqueueBundle` requests (preset or single-job) into
 *     {@link BundleSpec} for the scheduler.
 *   - Forward scheduler events (queue-changed / job-progress / lifecycle) to
 *     all renderer windows so the central queue slice stays in sync.
 *   - Provide imperative endpoints for cancel / remove / clear / snapshot.
 *
 * IMPORTANT: This handler intentionally does NOT register any
 * {@link PipelineDefinition}s — definitions are registered in
 * `pipelines/definitions/index.ts`. This keeps the IPC layer dependency-free
 * and lets tests register a minimal set of definitions.
 */
export function registerPipelineOrchestrationHandlers(): void {
  ipcMain.handle(
    PIPELINE_IPC_CHANNELS.enqueueBundle,
    (event, request: EnqueueBundleRequest): EnqueueBundleResponse => {
      const window = BrowserWindow.fromWebContents(event.sender) ?? undefined;
      let spec: BundleSpec | { kind: "rejection"; rejection: EnqueueBundleResponse } = {
        kind: "rejection",
        rejection: {
          ok: false,
          rejection: { kind: "unknown-pipeline", pipelineId: "(no spec)" },
        },
      } as never;

      if (request.kind === "single-job") {
        spec = {
          displayName: request.payload.displayName,
          jobs: [
            {
              pipelineId: request.payload.pipelineId,
              params: request.payload.params,
            },
          ],
          originatorWindow: window,
        };
      } else if (request.kind === "preset") {
        const preset = pipelinePresetRegistry.get(request.payload.presetId);
        if (!preset) {
          return {
            ok: false,
            rejection: { kind: "unknown-pipeline", pipelineId: `preset:${request.payload.presetId}` },
          };
        }
        const built = preset.build(request.payload.args ?? {});
        spec = {
          displayName: request.payload.displayName ?? built.displayName,
          jobs: built.jobs,
          originatorWindow: window,
        };
      }

      const result = pipelineScheduler.enqueueBundle(spec as BundleSpec);
      if (result.ok) {
        return { ok: true, bundleId: result.bundleId };
      }
      return { ok: false, rejection: result.rejection };
    },
  );

  ipcMain.handle(PIPELINE_IPC_CHANNELS.cancelBundle, (_event, bundleId: string): boolean => {
    return pipelineScheduler.cancelBundle(bundleId);
  });

  ipcMain.handle(PIPELINE_IPC_CHANNELS.cancelJob, (_event, jobId: string): boolean => {
    return pipelineScheduler.cancelJob(jobId);
  });

  ipcMain.handle(PIPELINE_IPC_CHANNELS.removeQueued, (_event, bundleId: string): boolean => {
    return pipelineScheduler.removeQueued(bundleId);
  });

  ipcMain.handle(PIPELINE_IPC_CHANNELS.clearQueue, (): void => {
    pipelineScheduler.clearQueue();
  });

  ipcMain.handle(PIPELINE_IPC_CHANNELS.getSnapshot, (): PipelineQueueSnapshot => {
    return pipelineScheduler.getSnapshot();
  });

  // Forward scheduler events to all windows. We intentionally broadcast (rather
  // than only sending to the originator) because the dock should reflect queue
  // state across all open windows.
  pipelineScheduler.on("queue-changed", (snapshot) => {
    broadcast(PIPELINE_IPC_CHANNELS.queueChanged, snapshot);
  });
  pipelineScheduler.on("job-progress", (event: JobProgressPushEvent) => {
    broadcast(PIPELINE_IPC_CHANNELS.jobProgress, event);
  });
  pipelineScheduler.on("lifecycle", (event: PipelineLifecycleEvent) => {
    broadcast(PIPELINE_IPC_CHANNELS.lifecycle, event);
  });
}

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue;
    try {
      window.webContents.send(channel, payload);
    } catch {
      // Renderer frame may be disposed (sleep/lock); safe to ignore.
    }
  }
}

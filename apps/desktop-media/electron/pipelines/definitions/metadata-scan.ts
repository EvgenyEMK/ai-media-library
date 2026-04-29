import type { MetadataScanProgressEvent } from "../../../src/shared/ipc";
import type { PipelineContext } from "../pipeline-context";
import type { PipelineDefinition } from "../pipeline-registry";
import { runMetadataScanJob, type MetadataScanRunResult } from "../../ipc/metadata-scan-handlers";

export interface MetadataScanParams {
  folderPath: string;
  recursive?: boolean;
  triggerSource?: "manual" | "auto";
}

export interface MetadataScanOutput extends MetadataScanRunResult {}

function mapMetadataProgressToPipeline(ctx: PipelineContext, event: MetadataScanProgressEvent): void {
  switch (event.type) {
    case "job-started":
      ctx.report({
        type: "started",
        total: event.total,
        message: `Scanning metadata in ${event.folderPath}`,
      });
      break;
    case "phase-updated":
      ctx.report({
        type: "phase-changed",
        phase: event.phase,
        processed: event.processed,
        total: event.total,
        message:
          event.phase === "geocoding" && typeof event.geoDataUpdated === "number"
            ? `Geocoding GPS (${event.geoDataUpdated} updated)`
            : undefined,
      });
      break;
    case "item-updated":
      ctx.report({
        type: "item-updated",
        message: `${event.item.status}: ${event.item.name}`,
        details: {
          path: event.item.path,
          status: event.item.status,
          action: event.item.action,
          error: event.item.error ?? null,
        },
      });
      break;
    case "job-completed":
      ctx.report({
        type: "phase-changed",
        phase: "completed",
        processed: event.total - event.cancelled,
        total: event.total,
        message: `Created ${event.created}, updated ${event.updated}, failed ${event.failed}`,
      });
      break;
  }
}

function validateParams(params: unknown):
  | { ok: true; value: MetadataScanParams }
  | { ok: false; issues: string } {
  if (typeof params !== "object" || params === null) {
    return { ok: false, issues: "params must be an object" };
  }
  const candidate = params as Record<string, unknown>;
  const folderPath = typeof candidate.folderPath === "string" ? candidate.folderPath.trim() : "";
  if (!folderPath) {
    return { ok: false, issues: "folderPath is required" };
  }
  const recursive = candidate.recursive === true;
  const triggerSource = candidate.triggerSource === "auto" ? "auto" : "manual";
  return {
    ok: true,
    value: { folderPath, recursive, triggerSource },
  };
}

export const metadataScanDefinition: PipelineDefinition<MetadataScanParams, MetadataScanOutput> = {
  id: "metadata-scan",
  displayName: "Scan folder metadata",
  concurrencyGroup: "io",
  validateParams: (params) => validateParams(params),
  run: async (ctx, params) => {
    return runMetadataScanJob({
      folderPath: params.folderPath,
      recursive: params.recursive === true,
      triggerSource: params.triggerSource ?? "manual",
      jobId: ctx.jobId,
      signal: ctx.signal,
      onProgressEvent: (event) => mapMetadataProgressToPipeline(ctx, event),
    });
  },
};


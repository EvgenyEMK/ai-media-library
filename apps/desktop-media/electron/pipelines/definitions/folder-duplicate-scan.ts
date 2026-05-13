import type { FolderDuplicateScanResultPayload } from "../../../src/shared/ipc";
import { runFolderDuplicateScan } from "../../db/folder-duplicate-scan";
import { storeFolderDuplicateScanResult } from "../../ipc/folder-duplicate-scan-cache";
import type { PipelineContext } from "../pipeline-context";
import type { PipelineDefinition } from "../pipeline-registry";

export interface FolderDuplicateScanParams {
  folderPath: string;
  recursive?: boolean;
}

export interface FolderDuplicateScanOutput extends FolderDuplicateScanResultPayload {}

function validateParams(params: unknown):
  | { ok: true; value: FolderDuplicateScanParams }
  | { ok: false; issues: string } {
  if (typeof params !== "object" || params === null) {
    return { ok: false, issues: "params must be an object" };
  }
  const candidate = params as Record<string, unknown>;
  const folderPath = typeof candidate.folderPath === "string" ? candidate.folderPath.trim() : "";
  if (!folderPath) {
    return { ok: false, issues: "folderPath is required" };
  }
  const recursive = candidate.recursive !== false;
  return { ok: true, value: { folderPath, recursive } };
}

export const folderDuplicateScanDefinition: PipelineDefinition<
  FolderDuplicateScanParams,
  FolderDuplicateScanOutput
> = {
  id: "folder-duplicate-scan",
  displayName: "Check duplicate files",
  concurrencyGroup: "io",
  validateParams: (params) => validateParams(params),
  run: async (ctx, params) => {
    ctx.report({
      type: "started",
      message: `Scanning for duplicates in ${params.folderPath}`,
    });

    const result = await runFolderDuplicateScan({
      folderPath: params.folderPath,
      recursive: params.recursive !== false,
      signal: ctx.signal,
      onProgress: (processed, total, message) => {
        ctx.report({
          type: "phase-changed",
          phase: "scanning",
          processed,
          total,
          message,
        });
      },
    });

    const dupCount = result.rows.length;
    ctx.report({
      type: "phase-changed",
      phase: "completed",
      processed: dupCount,
      total: dupCount,
      message: `${dupCount} file(s) with duplicates; skipped unresolved hash ${result.skippedMissingContentHashCount}`,
    });

    storeFolderDuplicateScanResult(ctx.jobId, result);
    return result;
  },
};

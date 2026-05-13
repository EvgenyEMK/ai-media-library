import type {
  DuplicateMarkedFilesDeleteJobResult,
  DuplicateMarkedFilesDeleteParams,
} from "../../../src/shared/ipc";
import { runDuplicateMarkedFilesDelete } from "../../lib/run-duplicate-marked-files-delete";
import type { PipelineContext } from "../pipeline-context";
import type { PipelineDefinition } from "../pipeline-registry";

function validateParams(params: unknown):
  | { ok: true; value: DuplicateMarkedFilesDeleteParams }
  | { ok: false; issues: string } {
  if (typeof params !== "object" || params === null) {
    return { ok: false, issues: "params must be an object" };
  }
  const candidate = params as Record<string, unknown>;
  if (!Array.isArray(candidate.targets)) {
    return { ok: false, issues: "targets must be an array" };
  }
  if (candidate.targets.length === 0) {
    return { ok: false, issues: "targets must not be empty" };
  }
  if (candidate.targets.length > 10_000) {
    return { ok: false, issues: "too many targets (max 10000)" };
  }
  const targets: DuplicateMarkedFilesDeleteParams["targets"] = [];
  for (const raw of candidate.targets) {
    if (typeof raw !== "object" || raw === null) {
      return { ok: false, issues: "each target must be an object" };
    }
    const t = raw as Record<string, unknown>;
    const mediaItemId = typeof t.mediaItemId === "string" ? t.mediaItemId.trim() : "";
    const sourcePath = typeof t.sourcePath === "string" ? t.sourcePath.trim() : "";
    if (!mediaItemId || !sourcePath) {
      return { ok: false, issues: "each target needs mediaItemId and sourcePath" };
    }
    targets.push({ mediaItemId, sourcePath });
  }
  const useTrash = candidate.useTrash !== false;
  return { ok: true, value: { targets, useTrash } };
}

export const duplicateMarkedFilesDeleteDefinition: PipelineDefinition<
  DuplicateMarkedFilesDeleteParams,
  DuplicateMarkedFilesDeleteJobResult
> = {
  id: "duplicate-marked-files-delete",
  displayName: "Delete duplicate files",
  concurrencyGroup: "io",
  validateParams: (params) => validateParams(params),
  run: async (ctx: PipelineContext, params: DuplicateMarkedFilesDeleteParams) => {
    ctx.report({
      type: "started",
      message: "Preparing file deletion",
    });
    const result = await runDuplicateMarkedFilesDelete(ctx, params);
    const ok = result.deletedMediaItemIds.length;
    const bad = result.failed.length;
    ctx.report({
      type: "phase-changed",
      phase: "completed",
      processed: ok + bad,
      total: ok + bad,
      message:
        bad === 0
          ? `Removed ${ok} file(s) from the library`
          : `Removed ${ok} file(s); ${bad} failed`,
    });
    return result;
  },
};

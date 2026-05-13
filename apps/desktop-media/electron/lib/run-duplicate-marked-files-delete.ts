import fs from "node:fs/promises";
import path from "node:path";
import { shell } from "electron";
import type {
  DuplicateMarkedFilesDeleteJobResult,
  DuplicateMarkedFilesDeleteTarget,
} from "../../src/shared/ipc";
import {
  resolveActiveMediaItemPathForDeletion,
  softDeleteMediaItemForUserRemovedFile,
} from "../db/media-item-reconciliation";
import type { PipelineContext } from "../pipelines/pipeline-context";

function dedupeTargets(targets: DuplicateMarkedFilesDeleteTarget[]): DuplicateMarkedFilesDeleteTarget[] {
  const byId = new Map<string, DuplicateMarkedFilesDeleteTarget>();
  for (const t of targets) {
    byId.set(t.mediaItemId, t);
  }
  return [...byId.values()];
}

function abortIfNeeded(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

export async function runDuplicateMarkedFilesDelete(
  ctx: PipelineContext,
  params: { targets: DuplicateMarkedFilesDeleteTarget[]; useTrash: boolean },
): Promise<DuplicateMarkedFilesDeleteJobResult> {
  const targets = dedupeTargets(params.targets);
  const useTrash = params.useTrash;
  const total = targets.length;
  const deletedMediaItemIds: string[] = [];
  const failed: DuplicateMarkedFilesDeleteJobResult["failed"] = [];

  ctx.report({
    type: "started",
    total,
    message: total === 1 ? "Deleting 1 file" : `Deleting ${total} files`,
  });

  for (let i = 0; i < targets.length; i++) {
    abortIfNeeded(ctx.signal);
    const t = targets[i]!;
    const resolved = resolveActiveMediaItemPathForDeletion({
      mediaItemId: t.mediaItemId,
      expectedSourcePath: t.sourcePath,
    });
    if (!resolved.ok) {
      const err =
        resolved.reason === "path_mismatch"
          ? "Catalog path no longer matches the duplicate view (skipped)."
          : "File is not in the catalog or was already removed (skipped).";
      failed.push({ mediaItemId: t.mediaItemId, sourcePath: t.sourcePath, error: err });
      ctx.report({
        type: "phase-changed",
        phase: "deleting",
        processed: i + 1,
        total,
        message: `${path.basename(t.sourcePath)}: ${err}`,
      });
      continue;
    }

    const diskPath = resolved.sourcePath;
    const label = path.basename(diskPath);

    try {
      if (useTrash) {
        await shell.trashItem(diskPath);
      } else {
        await fs.unlink(diskPath);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push({ mediaItemId: t.mediaItemId, sourcePath: diskPath, error: msg });
      ctx.report({
        type: "phase-changed",
        phase: "deleting",
        processed: i + 1,
        total,
        message: `${label}: ${msg}`,
      });
      continue;
    }

    const soft = softDeleteMediaItemForUserRemovedFile({
      mediaItemId: t.mediaItemId,
      expectedSourcePath: diskPath,
    });
    if (!soft.ok) {
      const msg =
        soft.reason === "path_mismatch"
          ? "Catalog path changed while deleting (database not updated)."
          : "Catalog row missing while updating (database not updated).";
      failed.push({ mediaItemId: t.mediaItemId, sourcePath: diskPath, error: msg });
    } else {
      deletedMediaItemIds.push(t.mediaItemId);
    }

    ctx.report({
      type: "phase-changed",
      phase: "deleting",
      processed: i + 1,
      total,
      message: useTrash ? `Trashed ${label}` : `Deleted ${label}`,
    });
  }

  return { deletedMediaItemIds, failed };
}

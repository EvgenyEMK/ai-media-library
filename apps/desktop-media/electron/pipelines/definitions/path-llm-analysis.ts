import path from "node:path";
import type { PipelineDefinition } from "../pipeline-registry";
import {
  collectFoldersRecursivelyWithProgress,
  collectImageEntriesForFoldersWithProgress,
  ensureCatalogForImagesWithProgress,
} from "../../ipc/folder-utils";
import {
  analyzePathsWithLlmStreaming,
  type LlmPathResult,
} from "../../path-extraction/llm-path-analyzer";
import {
  folderContextFromResult,
  getUniqueParentFolders,
  mergeResultWithFolderContext,
  normalizePathList,
  persistLlmPathResult,
  splitPathsForLlm,
} from "../../ipc/path-analysis-handlers";
import { app } from "electron";
import { readSettings } from "../../storage";
import {
  getOllamaBaseUrlForModelResolve,
  resolveOllamaTextChatModel,
} from "../../ollama-model-resolve";

export interface PathLlmAnalysisParams {
  folderPath: string;
  recursive?: boolean;
  model?: string;
}

export interface PathLlmAnalysisOutput {
  total: number;
  processed: number;
  failed: number;
  cancelled: number;
}

function validateParams(params: unknown):
  | { ok: true; value: PathLlmAnalysisParams }
  | { ok: false; issues: string } {
  if (typeof params !== "object" || params === null) {
    return { ok: false, issues: "params must be an object" };
  }
  const candidate = params as Record<string, unknown>;
  const folderPath = typeof candidate.folderPath === "string" ? candidate.folderPath.trim() : "";
  if (!folderPath) return { ok: false, issues: "folderPath is required" };
  return {
    ok: true,
    value: {
      folderPath,
      recursive: candidate.recursive === true,
      model: typeof candidate.model === "string" ? candidate.model : undefined,
    },
  };
}

export const pathLlmAnalysisDefinition: PipelineDefinition<PathLlmAnalysisParams, PathLlmAnalysisOutput> =
  {
    id: "path-llm-analysis",
    displayName: "Extract context from folder paths (LLM)",
    concurrencyGroup: "ollama",
    validateParams: (params) => validateParams(params),
    run: async (ctx, params) => {
      const folders = params.recursive
        ? await collectFoldersRecursivelyWithProgress(params.folderPath)
        : [params.folderPath];
      const imageEntries = await collectImageEntriesForFoldersWithProgress(folders);
      const paths = normalizePathList(imageEntries.map((entry) => entry.path));
      await ensureCatalogForImagesWithProgress(paths);

      const userModel = params.model?.trim() || null;
      let primaryModelId: string | null = null;
      let fallbackModelId: string | null = null;
      try {
        const appSettings = await readSettings(app.getPath("userData"));
        primaryModelId = appSettings.pathExtraction.llmModelPrimary;
        fallbackModelId = appSettings.pathExtraction.llmModelFallback;
      } catch {
        // Use resolver defaults.
      }
      const ollamaModel = await resolveOllamaTextChatModel({
        preferred: userModel,
        primaryModelId,
        fallbackModelId,
      });
      if (!ollamaModel) {
        throw new Error(
          `No suitable Ollama text model found at ${getOllamaBaseUrlForModelResolve()}. Pull configured models first.`,
        );
      }

      const foldersForLlm = getUniqueParentFolders(paths);
      const { pathsForFileLlm, skippedCameraPrefixPaths } = splitPathsForLlm(paths);
      const folderContextByFolder = new Map<string, ReturnType<typeof folderContextFromResult>>();

      let processed = 0;
      let failed = 0;
      let cancelled = 0;
      const total = paths.length;

      ctx.report({
        type: "started",
        total,
        message: `Path LLM analysis for ${total} files`,
      });

      if (foldersForLlm.length > 0) {
        await analyzePathsWithLlmStreaming(foldersForLlm, ollamaModel, async ({ batchPaths, batchResults }) => {
          const n = Math.min(batchPaths.length, batchResults.length);
          for (let i = 0; i < n; i++) {
            folderContextByFolder.set(batchPaths[i]!, folderContextFromResult(batchResults[i]!));
          }
          return !ctx.signal.aborted;
        });
      }

      if (ctx.signal.aborted) {
        return { total, processed: 0, failed: 0, cancelled: total };
      }

      await analyzePathsWithLlmStreaming(pathsForFileLlm, ollamaModel, async ({ batchPaths, batchResults }) => {
        if (ctx.signal.aborted) return false;
        const n = Math.min(batchPaths.length, batchResults.length);
        for (let i = 0; i < n; i++) {
          if (ctx.signal.aborted) return false;
          const filePath = batchPaths[i]!;
          try {
            const mergedResult = mergeResultWithFolderContext(
              batchResults[i] as LlmPathResult,
              folderContextByFolder.get(path.dirname(filePath)),
            );
            persistLlmPathResult(filePath, mergedResult, ollamaModel);
            processed += 1;
          } catch {
            failed += 1;
          }
        }
        if (batchPaths.length > n) {
          failed += batchPaths.length - n;
        }
        ctx.report({
          type: "item-updated",
          processed: processed + failed,
          total,
          message: `Processed ${processed + failed}/${total}`,
          details: { processed, failed },
        });
        return !ctx.signal.aborted;
      });

      for (const filePath of skippedCameraPrefixPaths) {
        if (ctx.signal.aborted) break;
        const folderContext = folderContextByFolder.get(path.dirname(filePath));
        const fallbackResult: LlmPathResult = {
          index: 0,
          date: folderContext?.date
            ? {
                start: folderContext.date.start,
                end: folderContext.date.end,
                precision: folderContext.date.precision,
              }
            : null,
          location: folderContext?.location
            ? {
                country: folderContext.location.country ?? null,
                country_code: folderContext.location.country_code ?? null,
                area: folderContext.location.area ?? null,
                city: folderContext.location.city ?? null,
              }
            : null,
          display_title: null,
        };
        try {
          persistLlmPathResult(filePath, fallbackResult, ollamaModel);
          processed += 1;
        } catch {
          failed += 1;
        }
      }

      if (ctx.signal.aborted) {
        cancelled = Math.max(0, total - processed - failed);
      }
      return { total, processed, failed, cancelled };
    },
  };


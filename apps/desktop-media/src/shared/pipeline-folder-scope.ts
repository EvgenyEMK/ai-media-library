import type { BundleView, JobView, PipelineId } from "./pipeline-types";

export interface FolderScopedPipelineJob {
  pipelineId: PipelineId;
  params: unknown;
}

export interface ActiveFolderPipelineMatch {
  bundleId: string;
  jobId: string;
  pipelineId: PipelineId;
  folderPath: string;
  state: JobView["state"] | "pending";
}

interface FolderJobScope {
  folderPath: string;
  recursive: boolean;
}

export function findActiveFolderPipelineMatch(options: {
  bundles: BundleView[];
  pipelineId: PipelineId;
  folderPath: string;
}): ActiveFolderPipelineMatch | null {
  for (const bundle of options.bundles) {
    for (const job of bundle.jobs) {
      if (job.pipelineId !== options.pipelineId) continue;
      if (job.state !== "pending" && job.state !== "running") continue;
      const existingScope = folderScopeFromParams(job.params);
      if (!existingScope) continue;
      if (!folderIsCoveredByScope(options.folderPath, existingScope)) continue;
      return {
        bundleId: bundle.bundleId,
        jobId: job.jobId,
        pipelineId: job.pipelineId,
        folderPath: existingScope.folderPath,
        state: job.state,
      };
    }
  }
  return null;
}

export function folderScopeFromParams(params: unknown): FolderJobScope | null {
  if (typeof params !== "object" || params === null) return null;
  const candidate = params as Record<string, unknown>;
  if (typeof candidate.folderPath !== "string" || candidate.folderPath.trim().length === 0) return null;
  return {
    folderPath: candidate.folderPath,
    recursive: candidate.recursive === true,
  };
}

export function folderIsCoveredByScope(folderPath: string, existing: FolderJobScope): boolean {
  const target = normalizeFolderPathForMatch(folderPath);
  const parent = normalizeFolderPathForMatch(existing.folderPath);
  if (!target || !parent) return false;
  if (target === parent) return true;
  return existing.recursive && target.startsWith(`${parent}/`);
}

export function normalizeFolderPathForMatch(folderPath: string): string {
  const trimmed = folderPath.trim();
  if (!trimmed) return "";
  const caseInsensitive = /^[a-z]:/i.test(trimmed) || trimmed.includes("\\");
  const normalized = trimmed.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/+$/g, "");
  return caseInsensitive ? normalized.toLowerCase() : normalized;
}

import {
  DEFAULT_PIPELINE_CONCURRENCY,
  type PipelineConcurrencyConfig,
} from "./pipeline-types";

/**
 * In-memory snapshot of the pipeline concurrency config. The scheduler reads
 * this through {@link getCurrentPipelineConcurrency} on every scheduling
 * decision; settings persistence calls {@link setPipelineConcurrencyConfig}
 * after a successful save.
 *
 * Falling back to {@link DEFAULT_PIPELINE_CONCURRENCY} keeps the scheduler
 * functional even if settings have not been hydrated yet (e.g. during the
 * narrow window between app start and the first `readSettings` call).
 */
let currentConfig: PipelineConcurrencyConfig = DEFAULT_PIPELINE_CONCURRENCY;

export function getCurrentPipelineConcurrency(): PipelineConcurrencyConfig {
  return currentConfig;
}

export function setPipelineConcurrencyConfig(config: PipelineConcurrencyConfig): void {
  currentConfig = sanitiseConfig(config);
}

/**
 * Validates and normalises a config payload coming from settings (which may
 * have been edited by hand or written by an older version). Out-of-range
 * limits are clamped so the scheduler can never deadlock on a 0 cap.
 */
function sanitiseConfig(config: PipelineConcurrencyConfig): PipelineConcurrencyConfig {
  const groupLimits = { ...DEFAULT_PIPELINE_CONCURRENCY.groupLimits };
  for (const key of Object.keys(groupLimits) as Array<keyof typeof groupLimits>) {
    const supplied = config.groupLimits?.[key];
    if (typeof supplied === "number" && Number.isFinite(supplied)) {
      groupLimits[key] = Math.max(1, Math.min(8, Math.floor(supplied)));
    }
  }
  return {
    groupLimits,
    perPipelineGroupOverride: config.perPipelineGroupOverride,
  };
}

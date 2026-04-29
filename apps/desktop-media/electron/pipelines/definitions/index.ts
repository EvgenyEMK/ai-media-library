/**
 * Central registration of all {@link PipelineDefinition}s.
 *
 * Real implementations are registered here as Phase 3 fills them in. Pipelines
 * that have not yet been migrated remain stubs (their `run()` throws so that
 * accidental invocation surfaces a clear error instead of silently no-op-ing).
 *
 * Phase 4 onwards relies on this single entry point: anywhere the renderer can
 * enqueue a bundle, the affected pipelines must be registered here first.
 */

import { pipelineRegistry } from "../pipeline-registry";
import type { PipelineDefinition } from "../pipeline-registry";
import type { PipelineConcurrencyGroup, PipelineId } from "../pipeline-types";
import { geocoderInitDefinition } from "./geocoder-init";
import { gpsGeocodeDefinition } from "./gps-geocode";
import { pathRuleExtractionDefinition } from "./path-rule-extraction";
import { metadataScanDefinition } from "./metadata-scan";
import { registerAllPresets } from "../presets";

/**
 * Build a stub definition that throws when invoked. Used for pipelines whose
 * legacy runners have not yet been wrapped (e.g. metadata-scan, face-detection,
 * photo-analysis, semantic-index). These can still be reached through their
 * legacy IPC channels — the scheduler simply cannot execute them yet.
 */
function stubDefinition(opts: {
  id: PipelineId;
  displayName: string;
  concurrencyGroup: PipelineConcurrencyGroup;
}): PipelineDefinition<unknown, never> {
  return {
    id: opts.id,
    displayName: opts.displayName,
    concurrencyGroup: opts.concurrencyGroup,
    run: () => {
      throw new Error(
        `[pipelines] Pipeline "${opts.id}" is registered but not yet implemented through the scheduler. ` +
          `Use the legacy IPC channel until the runner is migrated.`,
      );
    },
  };
}

/**
 * Register every known pipeline. Idempotent — re-registering replaces the
 * existing entry (with a console.warn from the registry).
 */
export function registerAllPipelineDefinitions(): void {
  // -------------------------------------------------------------------------
  // Real implementations (Phase 3+)
  // -------------------------------------------------------------------------
  pipelineRegistry.register(geocoderInitDefinition);
  pipelineRegistry.register(gpsGeocodeDefinition);
  pipelineRegistry.register(pathRuleExtractionDefinition);
  pipelineRegistry.register(metadataScanDefinition);

  // -------------------------------------------------------------------------
  // Stubs — legacy runners still reachable through their existing IPC channels
  // -------------------------------------------------------------------------
  const stubs: Array<{
    id: PipelineId;
    displayName: string;
    concurrencyGroup: PipelineConcurrencyGroup;
  }> = [
    {
      id: "image-rotation-precheck",
      displayName: "Detect wrongly rotated images",
      concurrencyGroup: "gpu",
    },
    { id: "face-detection", displayName: "Detect faces", concurrencyGroup: "gpu" },
    { id: "face-embedding", displayName: "Compute face embeddings", concurrencyGroup: "gpu" },
    { id: "face-clustering", displayName: "Group faces by similarity", concurrencyGroup: "cpu" },
    {
      id: "similar-untagged-counts",
      displayName: "Count similar untagged faces",
      concurrencyGroup: "cpu",
    },
    { id: "photo-analysis", displayName: "Analyze photos with AI", concurrencyGroup: "ollama" },
    {
      id: "description-embedding",
      displayName: "Embed AI photo descriptions",
      concurrencyGroup: "gpu",
    },
    {
      id: "path-llm-analysis",
      displayName: "Extract context from folder paths (LLM)",
      concurrencyGroup: "ollama",
    },
    {
      id: "semantic-index",
      displayName: "Build semantic search index",
      concurrencyGroup: "gpu",
    },
    {
      id: "desc-embedding-backfill",
      displayName: "Backfill description embeddings",
      concurrencyGroup: "gpu",
    },
  ];
  for (const stub of stubs) {
    pipelineRegistry.register(stubDefinition(stub));
  }

  // Presets are registered alongside definitions so callers see a populated
  // preset registry by the time the IPC handler accepts requests.
  registerAllPresets();
}

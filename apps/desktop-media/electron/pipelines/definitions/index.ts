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
import { geocoderInitDefinition } from "./geocoder-init";
import { gpsGeocodeDefinition } from "./gps-geocode";
import { pathRuleExtractionDefinition } from "./path-rule-extraction";
import { metadataScanDefinition } from "./metadata-scan";
import { imageRotationPrecheckDefinition } from "./image-rotation-precheck";
import { faceDetectionDefinition } from "./face-detection";
import { faceEmbeddingDefinition } from "./face-embedding";
import { faceClusteringDefinition } from "./face-clustering";
import { similarUntaggedCountsDefinition } from "./similar-untagged-counts";
import { photoAnalysisDefinition } from "./photo-analysis";
import { descriptionEmbeddingDefinition } from "./description-embedding";
import { semanticIndexDefinition } from "./semantic-index";
import { descEmbeddingBackfillDefinition } from "./desc-embedding-backfill";
import { pathLlmAnalysisDefinition } from "./path-llm-analysis";
import { registerAllPresets } from "../presets";

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
  pipelineRegistry.register(imageRotationPrecheckDefinition);
  pipelineRegistry.register(faceDetectionDefinition);
  pipelineRegistry.register(faceEmbeddingDefinition);
  pipelineRegistry.register(faceClusteringDefinition);
  pipelineRegistry.register(similarUntaggedCountsDefinition);
  pipelineRegistry.register(photoAnalysisDefinition);
  pipelineRegistry.register(descriptionEmbeddingDefinition);
  pipelineRegistry.register(semanticIndexDefinition);
  pipelineRegistry.register(descEmbeddingBackfillDefinition);
  pipelineRegistry.register(pathLlmAnalysisDefinition);

  // Presets are registered alongside definitions so callers see a populated
  // preset registry by the time the IPC handler accepts requests.
  registerAllPresets();
}

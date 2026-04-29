import { useCallback, type ReactElement } from "react";
import { SettingsSectionCard, SettingsNumberField } from "@emk/media-viewer";
import { useDesktopStore, useDesktopStoreApi } from "../stores/desktop-store";
import {
  DEFAULT_PIPELINE_CONCURRENCY,
  type PipelineConcurrencyGroup,
} from "../../shared/pipeline-types";

/**
 * Settings card for the pipeline scheduler's per-group concurrency limits.
 *
 * The card reads the current limits from `pipelineConcurrencySettings` in the
 * desktop store and writes back via the same slice. Persistence to disk and
 * scheduler refresh happen in `useDesktopSettingsPersistence` (renderer) and
 * `saveSettings` IPC handler (main).
 *
 * Defaults preserve today's behaviour: heavy AI pipelines run strictly serial
 * (gpu=1, ollama=1) while filesystem and CPU work allows two parallel jobs.
 */
export function PipelineConcurrencySettings(): ReactElement {
  const store = useDesktopStoreApi();
  const config = useDesktopStore((s) => s.pipelineConcurrencySettings);

  const setLimit = useCallback(
    (group: PipelineConcurrencyGroup, value: number) => {
      store.setState((s) => {
        s.pipelineConcurrencySettings = {
          groupLimits: {
            ...s.pipelineConcurrencySettings.groupLimits,
            [group]: Math.max(1, Math.min(8, Math.floor(value))),
          },
          perPipelineGroupOverride: s.pipelineConcurrencySettings.perPipelineGroupOverride,
        };
      });
    },
    [store],
  );

  return (
    <SettingsSectionCard title="Pipeline concurrency (advanced)">
      <div className="space-y-3">
        <p className="m-0 text-sm leading-relaxed text-muted-foreground">
          How many pipelines may run in parallel within each resource group. Leave at the defaults
          unless your machine has spare GPU/CPU headroom — increasing limits can starve other apps
          and slow individual pipelines on shared hardware. Changes apply on the next scheduling
          pass; in-flight jobs are not interrupted.
        </p>
        <SettingsNumberField
          title="GPU group limit"
          description={`Pipelines: image-rotation-precheck, face-detection, face-embedding, semantic-index, description-embedding (default ${DEFAULT_PIPELINE_CONCURRENCY.groupLimits.gpu}).`}
          value={config.groupLimits.gpu}
          min={1}
          max={4}
          step={1}
          onChange={(value) => setLimit("gpu", value)}
        />
        <SettingsNumberField
          title="Ollama (LLM) group limit"
          description={`Pipelines: photo-analysis, path-llm-analysis (default ${DEFAULT_PIPELINE_CONCURRENCY.groupLimits.ollama}). Ollama serves one request at a time per model — keep this at 1 unless you run multiple model instances.`}
          value={config.groupLimits.ollama}
          min={1}
          max={4}
          step={1}
          onChange={(value) => setLimit("ollama", value)}
        />
        <SettingsNumberField
          title="CPU group limit"
          description={`Pipelines: path-rule-extraction, face-clustering, similar-untagged-counts (default ${DEFAULT_PIPELINE_CONCURRENCY.groupLimits.cpu}).`}
          value={config.groupLimits.cpu}
          min={1}
          max={8}
          step={1}
          onChange={(value) => setLimit("cpu", value)}
        />
        <SettingsNumberField
          title="I/O group limit"
          description={`Pipelines: metadata-scan, gps-geocode, geocoder-init (default ${DEFAULT_PIPELINE_CONCURRENCY.groupLimits.io}).`}
          value={config.groupLimits.io}
          min={1}
          max={8}
          step={1}
          onChange={(value) => setLimit("io", value)}
        />
      </div>
    </SettingsSectionCard>
  );
}

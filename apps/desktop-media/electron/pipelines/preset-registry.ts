import type { JobSpec } from "./pipeline-scheduler";

/**
 * Output of a preset composer: the bundle's display name plus the list of
 * jobs (with optional `inputBinding`s already wired up).
 */
export interface ComposedBundle {
  displayName: string;
  jobs: JobSpec[];
}

/**
 * Registered preset that knows how to compose a {@link ComposedBundle} from a
 * free-form args bag. Each preset declares its own typed args contract via
 * the `Args` generic; the registry stores erased forms for easy lookup.
 *
 * Presets are the renderer-facing way to enqueue rich bundles since the
 * renderer cannot pass live `inputBinding.mapper` closures over IPC.
 */
export interface PipelinePreset<Args extends Record<string, unknown> = Record<string, unknown>> {
  /** Stable identifier used in `EnqueueBundlePresetRequest.presetId`. */
  id: string;
  /** Default display name (overridable per enqueue). */
  displayName: string;
  /** Builds the bundle from typed args. May throw if args are invalid. */
  build(args: Args): ComposedBundle;
}

/**
 * Singleton registry of pipeline presets. Phase 3b populates this with the
 * actual preset definitions (full-folder-index, metadata-only, geo-only,
 * face-only). Earlier phases register the empty registry so the IPC handler
 * can compile and run without blowing up.
 */
class PipelinePresetRegistry {
  private readonly presets = new Map<string, PipelinePreset>();

  register(preset: PipelinePreset): void {
    if (this.presets.has(preset.id)) {
      console.warn(`[pipelines] Replacing existing preset id="${preset.id}"`);
    }
    this.presets.set(preset.id, preset);
  }

  get(id: string): PipelinePreset | undefined {
    return this.presets.get(id);
  }

  list(): PipelinePreset[] {
    return Array.from(this.presets.values());
  }

  /** Test-only utility. */
  clear(): void {
    this.presets.clear();
  }
}

export const pipelinePresetRegistry = new PipelinePresetRegistry();

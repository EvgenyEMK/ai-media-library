import type { PipelineContext } from "./pipeline-context";
import type {
  PipelineConcurrencyGroup,
  PipelineId,
} from "./pipeline-types";

/**
 * Declarative description of a pipeline kind. Definitions are registered once
 * at app startup; the scheduler queries the registry to look up the runner,
 * the concurrency group, and (optionally) a Zod schema for params validation.
 *
 * Definitions are deliberately decoupled from BrowserWindow / IPC concerns so
 * tests can register lightweight definitions without touching Electron APIs.
 */
export interface PipelineDefinition<Params = unknown, Output = unknown> {
  id: PipelineId;
  /** Human-friendly label for the dock cards and the run-pipelines sheet. */
  displayName: string;
  /**
   * Concurrency group this pipeline competes within. The user can override per
   * pipeline through `perPipelineGroupOverride` in
   * `pipelineConcurrency` settings.
   */
  concurrencyGroup: PipelineConcurrencyGroup;
  /**
   * Optional params validator. The scheduler runs this when a bundle is
   * enqueued and rejects the bundle if validation fails. Use a function (e.g.
   * a Zod-backed parser) so we don't introduce a Zod dependency at this layer.
   */
  validateParams?: (params: unknown) => { ok: true; value: Params } | { ok: false; issues: string };
  /**
   * Default params merged into the supplied params before validation. Useful
   * for optional flags that most callers shouldn't have to spell out.
   */
  defaultParams?: Partial<Params>;
  /**
   * Runs the pipeline. Should respect `ctx.signal` for cancellation and emit
   * progress through `ctx.report`. Returns the typed `Output` on success.
   */
  run(ctx: PipelineContext, params: Params): Promise<Output>;
}

/**
 * Type-erased version of {@link PipelineDefinition} for storage in the
 * registry. The scheduler relies on the typed `PipelineDefinition` only at the
 * call boundary; internally everything works with `AnyPipelineDefinition`.
 */
export type AnyPipelineDefinition = PipelineDefinition<unknown, unknown>;

/**
 * Registry of all known pipeline kinds.
 *
 * Definitions are registered once during main-process startup (e.g. from
 * `registerAllPipelineDefinitions()` in `pipelines/definitions/index.ts`).
 * Re-registering the same id replaces the previous definition (helpful for
 * tests; warns in production). Returns `false` if the id was already taken.
 */
class PipelineRegistry {
  private readonly definitions = new Map<PipelineId, AnyPipelineDefinition>();

  register<Params, Output>(definition: PipelineDefinition<Params, Output>): boolean {
    const previousExisted = this.definitions.has(definition.id);
    if (previousExisted) {
      console.warn(
        `[pipelines] Replacing existing pipeline definition for id="${definition.id}"`,
      );
    }
    this.definitions.set(definition.id, definition as AnyPipelineDefinition);
    return !previousExisted;
  }

  get(pipelineId: PipelineId): AnyPipelineDefinition | undefined {
    return this.definitions.get(pipelineId);
  }

  has(pipelineId: PipelineId): boolean {
    return this.definitions.has(pipelineId);
  }

  list(): AnyPipelineDefinition[] {
    return Array.from(this.definitions.values());
  }

  /** Test-only utility: clears all registered definitions. */
  clear(): void {
    this.definitions.clear();
  }
}

/**
 * Singleton registry instance shared across the main process. Tests can call
 * `pipelineRegistry.clear()` and re-register lightweight definitions.
 */
export const pipelineRegistry = new PipelineRegistry();

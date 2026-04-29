import { pipelinePresetRegistry, type ComposedBundle, type PipelinePreset } from "./preset-registry";
import type { JobSpec } from "./pipeline-scheduler";
import type { GpsGeocodeOutput, GpsGeocodeParams } from "./definitions/gps-geocode";
import type { PathRuleExtractionParams } from "./definitions/path-rule-extraction";
import type { GeocoderInitOutput } from "./definitions/geocoder-init";

/**
 * Args common to most presets.
 */
interface FolderArgs extends Record<string, unknown> {
  folderPath?: string;
  recursive?: boolean;
}

/**
 * Preset that runs a standalone GPS geocoding pass — useful for users who
 * already scanned their library and later toggled "Detect location from GPS".
 *
 * Bundle: [ geocoder-init -> gps-geocode ]. The first job initialises the
 * offline geocoder cache (downloading GeoNames if needed) and the second
 * actually geocodes items. The downstream job is skipped if the geocoder
 * could not be initialised (`requireSuccess: true`, default).
 */
const geoOnlyPreset: PipelinePreset<FolderArgs> = {
  id: "geo-only",
  displayName: "Reverse geocode GPS coordinates",
  build: (args) => {
    const folderPath = typeof args.folderPath === "string" ? args.folderPath : undefined;
    const recursive = args.recursive !== false;

    const initJobId = "geocoder-init";
    const geocodeJobId = "gps-geocode";

    const jobs: JobSpec[] = [
      {
        jobId: initJobId,
        pipelineId: "geocoder-init",
        params: { forceRefresh: false },
      },
      {
        jobId: geocodeJobId,
        pipelineId: "gps-geocode",
        params: { folderPath, recursive } satisfies GpsGeocodeParams,
        // Bind explicitly so we get a clean skip when geocoder-init fails.
        inputBinding: {
          fromJobId: initJobId,
          mapper: (output: unknown): Partial<GpsGeocodeParams> => {
            const cast = output as GeocoderInitOutput | null;
            if (!cast || !cast.ready) {
              // Returning a marker object with no extra params lets the runner
              // detect the unready state via its own `isGeocoderReady` check.
              return {};
            }
            return {};
          },
        },
      },
    ];

    return {
      displayName: folderPath
        ? `Reverse geocode GPS — ${folderPath}`
        : "Reverse geocode GPS — entire library",
      jobs,
    };
  },
};

/**
 * Preset that re-runs the rule-based path/filename date extractor across a
 * folder (or the whole library) without touching anything else. Useful after
 * the user adjusts path-extraction rules and wants to refresh existing rows.
 */
const pathRuleOnlyPreset: PipelinePreset<FolderArgs> = {
  id: "path-rule-only",
  displayName: "Extract dates from filenames",
  build: () => {
    const jobs: JobSpec[] = [
      {
        jobId: "path-rule-extraction",
        pipelineId: "path-rule-extraction",
        params: {} satisfies PathRuleExtractionParams,
      },
    ];
    return { displayName: "Extract dates from filenames", jobs };
  },
};

/**
 * Combined preset that runs the rule-based path extractor and then the GPS
 * reverse-geocoder. Mirrors the post-scan phases of a legacy metadata scan
 * but as a standalone, re-runnable bundle.
 */
const pathAndGeoPreset: PipelinePreset<FolderArgs> = {
  id: "path-and-geo",
  displayName: "Path + GPS rules",
  build: (args) => {
    const folderPath = typeof args.folderPath === "string" ? args.folderPath : undefined;
    const recursive = args.recursive !== false;

    const pathJobId = "path-rule-extraction";
    const initJobId = "geocoder-init";
    const geocodeJobId = "gps-geocode";

    const jobs: JobSpec[] = [
      { jobId: pathJobId, pipelineId: "path-rule-extraction", params: {} },
      { jobId: initJobId, pipelineId: "geocoder-init", params: { forceRefresh: false } },
      {
        jobId: geocodeJobId,
        pipelineId: "gps-geocode",
        params: { folderPath, recursive } satisfies GpsGeocodeParams,
        inputBinding: {
          fromJobId: initJobId,
          mapper: (output: unknown): Partial<GpsGeocodeParams> => {
            // Output is informational here; the runner re-checks readiness
            // before doing real work.
            void (output as GeocoderInitOutput | null);
            return {};
          },
        },
      },
    ];
    return {
      displayName: folderPath
        ? `Path + GPS rules — ${folderPath}`
        : "Path + GPS rules — entire library",
      jobs,
    };
  },
};

/**
 * Register all presets. Called once at startup from
 * `registerAllPipelineDefinitions`. Re-registration replaces the existing
 * entry with a console.warn (consistent with the pipeline registry).
 */
export function registerAllPresets(): void {
  pipelinePresetRegistry.register(geoOnlyPreset as PipelinePreset);
  pipelinePresetRegistry.register(pathRuleOnlyPreset as PipelinePreset);
  pipelinePresetRegistry.register(pathAndGeoPreset as PipelinePreset);
}

/**
 * Stable list of preset ids exported for the renderer's RunPipelinesSheet.
 * Keep this in sync with the registrations above.
 */
export const KNOWN_PRESET_IDS = ["geo-only", "path-rule-only", "path-and-geo"] as const;
export type KnownPresetId = (typeof KNOWN_PRESET_IDS)[number];

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pipelinePresetRegistry } from "../preset-registry";
import { registerAllPresets } from "../presets";

describe("pipeline presets", () => {
  beforeEach(() => {
    pipelinePresetRegistry.clear();
    registerAllPresets();
  });

  afterEach(() => {
    pipelinePresetRegistry.clear();
  });

  it("registers the geo-only preset with geocoder-init -> gps-geocode chain", () => {
    const preset = pipelinePresetRegistry.get("geo-only");
    expect(preset).toBeDefined();
    const bundle = preset!.build({ folderPath: "/tmp/photos", recursive: true });
    expect(bundle.jobs).toHaveLength(2);
    expect(bundle.jobs[0]!.pipelineId).toBe("geocoder-init");
    expect(bundle.jobs[1]!.pipelineId).toBe("gps-geocode");
    expect(bundle.jobs[1]!.inputBinding?.fromJobId).toBe(bundle.jobs[0]!.jobId);
    expect(bundle.jobs[1]!.params).toEqual({ folderPath: "/tmp/photos", recursive: true });
  });

  it("falls back to library-wide gps-geocode when no folder is supplied", () => {
    const preset = pipelinePresetRegistry.get("geo-only")!;
    const bundle = preset.build({});
    const gpsJob = bundle.jobs.find((j) => j.pipelineId === "gps-geocode")!;
    expect(gpsJob.params).toEqual({ folderPath: undefined, recursive: true });
  });

  it("path-rule-only preset is a single-job bundle with no binding", () => {
    const preset = pipelinePresetRegistry.get("path-rule-only")!;
    const bundle = preset.build({});
    expect(bundle.jobs).toHaveLength(1);
    expect(bundle.jobs[0]!.pipelineId).toBe("path-rule-extraction");
    expect(bundle.jobs[0]!.inputBinding).toBeUndefined();
  });

  it("path-and-geo preset chains 3 jobs and only the gps-geocode has a binding", () => {
    const preset = pipelinePresetRegistry.get("path-and-geo")!;
    const bundle = preset.build({ folderPath: "/x" });
    expect(bundle.jobs.map((j) => j.pipelineId)).toEqual([
      "path-rule-extraction",
      "geocoder-init",
      "gps-geocode",
    ]);
    expect(bundle.jobs[0]!.inputBinding).toBeUndefined();
    expect(bundle.jobs[1]!.inputBinding).toBeUndefined();
    expect(bundle.jobs[2]!.inputBinding?.fromJobId).toBe(bundle.jobs[1]!.jobId);
  });

  it("returns undefined for unknown preset id", () => {
    expect(pipelinePresetRegistry.get("nope")).toBeUndefined();
  });
});

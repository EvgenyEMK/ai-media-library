import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EnqueueBundleResponse } from "../../shared/pipeline-ipc";
import { enqueueGeoOnlyPreset } from "./enqueue-geo-only-preset";

describe("enqueueGeoOnlyPreset", () => {
  const enqueueBundle = vi.fn((): Promise<EnqueueBundleResponse> =>
    Promise.resolve({ ok: true, bundleId: "bundle-test-geo-only" }),
  );

  beforeEach(() => {
    enqueueBundle.mockReset();
    vi.stubGlobal(
      "window",
      {
        desktopApi: {
          pipelines: { enqueueBundle },
        },
      } as unknown as Window & typeof globalThis,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects when folder path is empty", async () => {
    await expect(enqueueGeoOnlyPreset("  ")).rejects.toThrow("Folder path is required");
  });

  it("enqueues geo-only preset for the trimmed folder path", async () => {
    await enqueueGeoOnlyPreset("  /data/photos  ");
    expect(enqueueBundle).toHaveBeenCalledWith({
      kind: "preset",
      payload: {
        presetId: "geo-only",
        args: { folderPath: "/data/photos", recursive: true },
      },
    });
  });
});

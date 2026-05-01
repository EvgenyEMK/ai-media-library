import { app } from "electron";
import type { PipelineDefinition } from "../pipeline-registry";
import {
  collectFoldersRecursivelyWithProgress,
  ensureCatalogForImagesWithProgress,
} from "../../ipc/folder-utils";
import { listFolderImages } from "../../fs-media";
import { readSettings } from "../../storage";
import { runWrongImageRotationPrecheck } from "../../orientation-preprocess";
import {
  getOrientationDetectionStateByPath,
  upsertOrientationDetectionFailure,
} from "../../db/media-analysis";

export interface ImageRotationPrecheckParams {
  folderPath: string;
  recursive?: boolean;
  /** When true, recompute even when orientation state already exists. */
  force?: boolean;
}

export interface ImageRotationPrecheckOutput {
  total: number;
  processed: number;
  skipped: number;
  failed: number;
  disabled: number;
  wronglyRotated: number;
}

function validateParams(params: unknown):
  | { ok: true; value: ImageRotationPrecheckParams }
  | { ok: false; issues: string } {
  if (typeof params !== "object" || params === null) {
    return { ok: false, issues: "params must be an object" };
  }
  const candidate = params as Record<string, unknown>;
  const folderPath = typeof candidate.folderPath === "string" ? candidate.folderPath.trim() : "";
  if (!folderPath) {
    return { ok: false, issues: "folderPath is required" };
  }
  return {
    ok: true,
    value: {
      folderPath,
      recursive: candidate.recursive === true,
      force: candidate.force === true,
    },
  };
}

export const imageRotationPrecheckDefinition: PipelineDefinition<
  ImageRotationPrecheckParams,
  ImageRotationPrecheckOutput
> = {
  id: "image-rotation-precheck",
  displayName: "Detect wrongly rotated images",
  concurrencyGroup: "gpu",
  validateParams: (params) => validateParams(params),
  run: async (ctx, params) => {
    const folders = params.recursive
      ? await collectFoldersRecursivelyWithProgress(params.folderPath)
      : [params.folderPath];
    const imagesByFolder = await Promise.all(folders.map((folder) => listFolderImages(folder)));
    const images = imagesByFolder.flat();
    const imagePaths = images.map((image) => image.path);
    await ensureCatalogForImagesWithProgress(imagePaths);

    const settings = await readSettings(app.getPath("userData"));
    const rotationSettings = {
      ...settings,
      wrongImageRotationDetection: {
        ...settings.wrongImageRotationDetection,
        enabled: true,
      },
    };

    const selectedImages = params.force === true
      ? images
      : images.filter((image) => getOrientationDetectionStateByPath(image.path) === null);
    const selectedImagePaths = selectedImages.map((image) => image.path);
    let processed = 0;
    const skipped = imagePaths.length - selectedImagePaths.length;
    let failed = 0;
    let disabled = 0;
    let wronglyRotated = 0;

    ctx.report({
      type: "started",
      total: selectedImagePaths.length,
      message: `Checking orientation for ${selectedImagePaths.length} images`,
      details: { skipped },
    });
    ctx.report({
      type: "phase-changed",
      phase: "orientation-precheck",
      processed: 0,
      total: selectedImagePaths.length,
      details: { skipped },
    });

    for (let i = 0; i < selectedImagePaths.length; i++) {
      if (ctx.signal.aborted) break;
      const imagePath = selectedImagePaths[i]!;
      const image = selectedImages[i]!;
      let result: "processed" | "skipped" | "failed" | "disabled";
      try {
        result = await runWrongImageRotationPrecheck({
          imagePath,
          settings: rotationSettings,
          signal: ctx.signal,
          force: params.force === true,
        });
      } catch (error) {
        upsertOrientationDetectionFailure(
          imagePath,
          error instanceof Error ? error.message : "Unexpected image rotation precheck failure.",
        );
        result = "failed";
      }

      if (result === "processed") processed += 1;
      else if (result === "skipped") processed += 1;
      else if (result === "disabled") disabled += 1;
      else failed += 1;

      const state = getOrientationDetectionStateByPath(imagePath);
      if (state && [90, 180, 270].includes(state.correctionAngleClockwise)) {
        wronglyRotated += 1;
      }

      ctx.report({
        type: "item-updated",
        processed: processed + failed + disabled,
        total: selectedImagePaths.length,
        message: `${result}: ${image.name}`,
        details: {
          imagePath,
          result,
          correctionAngleClockwise: state?.correctionAngleClockwise ?? null,
          wronglyRotated,
          skipped,
          failed,
        },
      });
    }

    return {
      total: selectedImagePaths.length,
      processed,
      skipped,
      failed,
      disabled,
      wronglyRotated,
    };
  },
};


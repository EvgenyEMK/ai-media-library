/**
 * Photo analysis pipeline: orchestrates VLM analysis with face-landmark
 * rotation correction. Extracted so both the Electron main process and
 * automated tests share the identical code path.
 */

import type { QuarterTurnAngle } from "@emk/shared-contracts";
import type { FaceDetectionOutput, PhotoAnalysisOutput, PhotoEditSuggestion } from "../src/shared/ipc";
import {
  checkExistingFaceLandmarksForRotation,
  transformFacesToOriginalCoordinates,
  verifyVlmRotationWithFaceDetection,
  type RotationDetectedFaces,
} from "./face-rotation-check";
import {
  analyzePhotoWithOllama,
  createRotatedTempImage,
  extractInvoiceDocumentDataWithOllama,
} from "./photo-analysis";

export interface AnalyzePhotoWithOptionalTwoPassParams {
  imagePath: string;
  model: string;
  think: boolean | undefined;
  timeoutMs: number | undefined;
  signal: AbortSignal;
  enableTwoPassRotationConsistency: boolean;
  useFaceFeaturesForRotation: boolean;
  extractInvoiceData: boolean;
  /** Called when Tier 2 discovers faces on a rotated image. Coordinates are already in original pixel space. */
  onRotationPipelineFacesDetected?: (imagePath: string, faces: FaceDetectionOutput) => void;
}

export interface RotationDecisionInfo {
  tier: "tier1-face-existing" | "tier2-face-verified" | "tier3-vlm-two-pass" | "vlm-only" | "none";
  faceDetectedInDb: boolean;
  faceDbCount: number;
  faceOrientationOnOriginal: string | null;
  faceAngleFromDb: number | null;
  vlmFirstPassAngle: number | null;
  vlmSecondPassResidualAngle: number | null;
  faceOrientationOnRotated: string | null;
  faceAngleOnRotated: number | null;
  faceSource: string | null;
  finalAngle: number | null;
  fallbackReason: string | null;
}

export interface AnalysisResultWithDecision {
  output: PhotoAnalysisOutput;
  rotationDecision: RotationDecisionInfo;
}

function fileNameFromPath(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

function saveRotationPipelineFaces(
  detectedFaces: RotationDetectedFaces | null,
  imagePath: string,
  fileName: string,
  callback?: (imagePath: string, faces: FaceDetectionOutput) => void,
): void {
  if (!detectedFaces || !callback) {
    return;
  }
  try {
    const transformed = transformFacesToOriginalCoordinates(detectedFaces);
    if (transformed.faceCount > 0) {
      // Do not delete – may be needed for future debugging of face-rotation pipeline
      // console.log(
      //   `[face-rotation] Saving ${transformed.faceCount} rotation-pipeline face(s) for "${fileName}"` +
      //   ` (detected at ${detectedFaces.rotationAngleUsed}°, coords transformed to original)`,
      // );
      callback(imagePath, transformed);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Do not delete – may be needed for future debugging of face-rotation pipeline
    // console.warn(`[face-rotation] Failed to save rotation-pipeline faces for "${fileName}": ${msg}`);
  }
}

export async function analyzePhotoWithOptionalTwoPass(
  params: AnalyzePhotoWithOptionalTwoPassParams,
): Promise<AnalysisResultWithDecision> {
  const {
    imagePath,
    model,
    think,
    timeoutMs,
    signal,
    enableTwoPassRotationConsistency,
    useFaceFeaturesForRotation,
    extractInvoiceData,
    onRotationPipelineFacesDetected,
  } = params;
  const fileName = fileNameFromPath(imagePath);

  const decision: RotationDecisionInfo = {
    tier: "none",
    faceDetectedInDb: false,
    faceDbCount: 0,
    faceOrientationOnOriginal: null,
    faceAngleFromDb: null,
    vlmFirstPassAngle: null,
    vlmSecondPassResidualAngle: null,
    faceOrientationOnRotated: null,
    faceAngleOnRotated: null,
    faceSource: null,
    finalAngle: null,
    fallbackReason: null,
  };

  // Tier 1: If face features are enabled, check existing face landmarks first.
  if (useFaceFeaturesForRotation) {
    const existingFaceCheck = checkExistingFaceLandmarksForRotation(imagePath);
    if (existingFaceCheck) {
      decision.faceDetectedInDb = true;
      decision.faceDbCount = existingFaceCheck.landmarkResult?.faceCount ?? 0;
      decision.faceOrientationOnOriginal = existingFaceCheck.landmarkResult?.orientation ?? null;
      decision.faceAngleFromDb = existingFaceCheck.finalAngle;
      decision.faceSource = existingFaceCheck.source;

      if (existingFaceCheck.finalAngle !== 0) {
        // Do not delete – may be needed for future debugging of face-rotation pipeline
        // console.log(
        //   `[face-rotation] Tier1 "${fileName}": angle=${existingFaceCheck.finalAngle} source=${existingFaceCheck.source}` +
        //   ` orientation=${existingFaceCheck.landmarkResult?.orientation ?? "?"}` +
        //   ` confidence=${existingFaceCheck.landmarkResult?.confidence?.toFixed(2) ?? "?"}` +
        //   ` faceCount=${existingFaceCheck.landmarkResult?.faceCount ?? "?"}`,
        // );
        const firstPass = await analyzePhotoWithOllama({ imagePath, model, think, timeoutMs, signal });
        decision.tier = "tier1-face-existing";
        decision.finalAngle = existingFaceCheck.finalAngle;
        decision.vlmFirstPassAngle = getPrimaryRotateAngle(firstPass);
        const finalOutput = await maybeAttachInvoiceDocumentData({
          output: applyFaceRotationOverride(firstPass, existingFaceCheck.finalAngle, existingFaceCheck.source),
          imagePath,
          model,
          think,
          timeoutMs,
          signal,
          extractInvoiceData,
        });
        return {
          output: finalOutput,
          rotationDecision: decision,
        };
      }
    } else {
      // Do not delete – may be needed for future debugging of face-rotation pipeline
      // console.log(`[face-rotation] Tier1 "${fileName}": no strong signal from existing landmarks`);
    }
  }

  const firstPass = await analyzePhotoWithOllama({ imagePath, model, think, timeoutMs, signal });
  const firstAngle = getPrimaryRotateAngle(firstPass);
  decision.vlmFirstPassAngle = firstAngle;

  if (!firstAngle) {
    decision.tier = "vlm-only";
    decision.finalAngle = null;
    const finalOutput = await maybeAttachInvoiceDocumentData({
      output: firstPass,
      imagePath,
      model,
      think,
      timeoutMs,
      signal,
      extractInvoiceData,
    });
    return { output: finalOutput, rotationDecision: decision };
  }

  // Tier 2: VLM suggests rotation; verify with face detection if enabled.
  if (useFaceFeaturesForRotation) {
    try {
      const faceCheck = await verifyVlmRotationWithFaceDetection(
        imagePath, firstAngle, undefined, signal,
      );
      if (faceCheck) {
        // Do not delete – may be needed for future debugging of face-rotation pipeline
        // console.log(
        //   `[face-rotation] Tier2 "${fileName}": vlmAngle=${firstAngle} → faceAngle=${faceCheck.finalAngle}` +
        //   ` source=${faceCheck.source} orientation=${faceCheck.landmarkResult?.orientation ?? "?"}`,
        // );
        decision.tier = "tier2-face-verified";
        decision.faceOrientationOnRotated = faceCheck.landmarkResult?.orientation ?? null;
        decision.faceAngleOnRotated = faceCheck.finalAngle;
        decision.faceSource = faceCheck.source;
        decision.finalAngle = faceCheck.finalAngle;

        saveRotationPipelineFaces(faceCheck.detectedFaces, imagePath, fileName, onRotationPipelineFacesDetected);
        const finalOutput = await maybeAttachInvoiceDocumentData({
          output: applyFaceRotationOverride(firstPass, faceCheck.finalAngle, faceCheck.source),
          imagePath,
          model,
          think,
          timeoutMs,
          signal,
          extractInvoiceData,
        });

        return {
          output: finalOutput,
          rotationDecision: decision,
        };
      }
      // Do not delete – may be needed for future debugging of face-rotation pipeline
      // console.log(
      //   `[face-rotation] Tier2 "${fileName}": no face signal on rotated/flipped image, falling back to VLM two-pass`,
      // );
    } catch (faceErr) {
      const msg = faceErr instanceof Error ? faceErr.message : "unknown";
      // Do not delete – may be needed for future debugging of face-rotation pipeline
      // console.log(`[face-rotation] Tier2 "${fileName}": face detection unavailable (${msg}), falling back to VLM two-pass`);
      decision.fallbackReason = `face detection error: ${msg}`;
    }
  }

  // Tier 3: VLM two-pass fallback.
  if (!enableTwoPassRotationConsistency) {
    decision.tier = "vlm-only";
    decision.finalAngle = firstAngle;
    const finalOutput = await maybeAttachInvoiceDocumentData({
      output: firstPass,
      imagePath,
      model,
      think,
      timeoutMs,
      signal,
      extractInvoiceData,
    });
    return { output: finalOutput, rotationDecision: decision };
  }

  try {
    const rotated = await createRotatedTempImage(imagePath, firstAngle);
    try {
      const secondPass = await analyzePhotoWithOllama({
        imagePath: rotated.path, model, think, timeoutMs, signal,
      });
      const merged = mergeTwoPassPhotoAnalysis(firstPass, secondPass, firstAngle);
      decision.tier = "tier3-vlm-two-pass";
      decision.vlmSecondPassResidualAngle = getPrimaryRotateAngle(secondPass);
      decision.finalAngle = getPrimaryRotateAngle(merged);
      const finalOutput = await maybeAttachInvoiceDocumentData({
        output: merged,
        imagePath,
        model,
        think,
        timeoutMs,
        signal,
        extractInvoiceData,
      });
      return { output: finalOutput, rotationDecision: decision };
    } finally {
      await rotated.cleanup();
    }
  } catch (error) {
    if (signal.aborted) throw error;
    const reason = error instanceof Error ? error.message : "Unknown two-pass error";
    decision.tier = "tier3-vlm-two-pass";
    decision.finalAngle = firstAngle;
    decision.fallbackReason = reason;
    const fallbackOutput = {
        ...firstPass,
        two_pass_rotation_consistency: {
          enabled: true,
          first_pass_angle_clockwise: firstAngle,
          second_pass_residual_angle_clockwise: null,
          final_angle_clockwise: firstAngle,
          second_pass_used_for_non_rotation: false,
          fallback_reason: reason,
        },
      };
    const finalOutput = await maybeAttachInvoiceDocumentData({
      output: fallbackOutput,
      imagePath,
      model,
      think,
      timeoutMs,
      signal,
      extractInvoiceData,
    });
    return { output: finalOutput, rotationDecision: decision };
  }
}

async function maybeAttachInvoiceDocumentData(params: {
  output: PhotoAnalysisOutput;
  imagePath: string;
  model: string;
  think: boolean | undefined;
  timeoutMs: number | undefined;
  signal: AbortSignal;
  extractInvoiceData: boolean;
}): Promise<PhotoAnalysisOutput> {
  const { output, imagePath, model, think, timeoutMs, signal, extractInvoiceData } = params;
  if (!extractInvoiceData || output.image_category !== "invoice_or_receipt") {
    return output;
  }
  try {
    const documentData = await extractInvoiceDocumentDataWithOllama({
      imagePath,
      model,
      think,
      timeoutMs,
      signal,
    });
    if (!documentData) {
      return output;
    }
    return {
      ...output,
      document_data: documentData,
    };
  } catch {
    return output;
  }
}

export function applyFaceRotationOverride(
  vlmOutput: PhotoAnalysisOutput,
  faceAngle: QuarterTurnAngle | 0,
  source: string,
): PhotoAnalysisOutput {
  const suggestions = Array.isArray(vlmOutput.edit_suggestions)
    ? vlmOutput.edit_suggestions
    : [];

  const nonRotateSuggestions = suggestions.filter((s) => s.edit_type !== "rotate");

  const finalSuggestions: PhotoEditSuggestion[] =
    faceAngle === 0
      ? nonRotateSuggestions
      : [
          {
            edit_type: "rotate",
            priority: "high",
            reason: `Face-landmark orientation check (${source}).`,
            confidence: null,
            auto_apply_safe: true,
            rotation: { angle_degrees_clockwise: faceAngle },
          },
          ...nonRotateSuggestions,
        ];

  return {
    ...vlmOutput,
    edit_suggestions: dedupeSuggestions(finalSuggestions),
    face_rotation_override: {
      source,
      face_angle_clockwise: faceAngle,
      vlm_angle_clockwise: getPrimaryRotateAngle(vlmOutput),
    },
  };
}

export function getPrimaryRotateAngle(output: PhotoAnalysisOutput): QuarterTurnAngle | null {
  if (!Array.isArray(output.edit_suggestions)) {
    return null;
  }

  const rotateSuggestions = output.edit_suggestions.filter(
    (item) =>
      item.edit_type === "rotate" &&
      (item.rotation?.angle_degrees_clockwise === 90 ||
        item.rotation?.angle_degrees_clockwise === 180 ||
        item.rotation?.angle_degrees_clockwise === 270),
  );
  if (rotateSuggestions.length === 0) {
    return null;
  }

  rotateSuggestions.sort((a, b) => {
    const confidenceA = typeof a.confidence === "number" ? a.confidence : -1;
    const confidenceB = typeof b.confidence === "number" ? b.confidence : -1;
    return confidenceB - confidenceA;
  });
  return rotateSuggestions[0].rotation?.angle_degrees_clockwise ?? null;
}

export function combineRotationAngles(
  firstAngle: QuarterTurnAngle,
  secondResidualAngle: QuarterTurnAngle | null,
): QuarterTurnAngle | null {
  if (secondResidualAngle === null) {
    return firstAngle;
  }
  const total = (firstAngle + secondResidualAngle) % 360;
  if (total === 90 || total === 180 || total === 270) {
    return total;
  }
  return null;
}

export function dedupeSuggestions(
  suggestions: PhotoAnalysisOutput["edit_suggestions"],
): NonNullable<PhotoAnalysisOutput["edit_suggestions"]> {
  if (!Array.isArray(suggestions)) {
    return [];
  }
  const deduped: NonNullable<PhotoAnalysisOutput["edit_suggestions"]> = [];
  const seen = new Set<string>();
  for (const suggestion of suggestions) {
    const key = JSON.stringify({
      edit_type: suggestion.edit_type,
      rotation: suggestion.rotation ?? null,
      crop_rel: suggestion.crop_rel ?? null,
      crop_target: suggestion.crop_target ?? null,
      straighten: suggestion.straighten ?? null,
      exposure_fix: suggestion.exposure_fix ?? null,
      white_balance_fix: suggestion.white_balance_fix ?? null,
      contrast_fix: suggestion.contrast_fix ?? null,
      denoise: suggestion.denoise ?? null,
      sharpen: suggestion.sharpen ?? null,
    });
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(suggestion);
  }
  return deduped;
}

function mergeTwoPassPhotoAnalysis(
  firstPass: PhotoAnalysisOutput,
  secondPass: PhotoAnalysisOutput,
  firstAngle: QuarterTurnAngle,
): PhotoAnalysisOutput {
  const secondResidualAngle = getPrimaryRotateAngle(secondPass);
  const correctedAngle = combineRotationAngles(firstAngle, secondResidualAngle);
  const secondPassIsLikelyUpright = secondResidualAngle === null;

  const secondSuggestions = Array.isArray(secondPass.edit_suggestions)
    ? secondPass.edit_suggestions
    : [];
  const firstSuggestions = Array.isArray(firstPass.edit_suggestions)
    ? firstPass.edit_suggestions
    : [];

  const transformedSecondSuggestions = secondPassIsLikelyUpright
    ? transformSuggestionsToOriginalOrientation(secondSuggestions, firstAngle)
    : [];
  const firstFallbackSuggestions = firstSuggestions.filter((item) => item.edit_type !== "rotate");
  const mergedSuggestionsCore = secondPassIsLikelyUpright
    ? mergeNonRotateSuggestions(transformedSecondSuggestions, firstFallbackSuggestions)
    : firstFallbackSuggestions;

  const rotationSuggestion =
    correctedAngle === null
      ? null
      : buildMergedRotationSuggestion(firstPass, secondPass, firstAngle, secondResidualAngle, correctedAngle);
  const mergedSuggestions = dedupeSuggestions(
    rotationSuggestion ? [rotationSuggestion, ...mergedSuggestionsCore] : mergedSuggestionsCore,
  );

  const base = secondPassIsLikelyUpright ? secondPass : firstPass;
  return {
    ...base,
    edit_suggestions: mergedSuggestions,
    two_pass_rotation_consistency: {
      enabled: true,
      first_pass_angle_clockwise: firstAngle,
      second_pass_residual_angle_clockwise: secondResidualAngle,
      final_angle_clockwise: correctedAngle,
      second_pass_used_for_non_rotation: secondPassIsLikelyUpright,
    },
    modelInfo: firstPass.modelInfo,
  };
}

function transformSuggestionsToOriginalOrientation(
  suggestions: PhotoAnalysisOutput["edit_suggestions"],
  firstAngle: QuarterTurnAngle,
): PhotoAnalysisOutput["edit_suggestions"] {
  if (!Array.isArray(suggestions)) {
    return [];
  }

  const transformed: NonNullable<PhotoAnalysisOutput["edit_suggestions"]> = [];
  for (const suggestion of suggestions) {
    if (suggestion.edit_type === "rotate" || suggestion.edit_type === "straighten") {
      continue;
    }
    if (suggestion.edit_type === "crop" && suggestion.crop_rel) {
      const mappedCrop = mapCropFromRotatedToOriginal(suggestion.crop_rel, firstAngle);
      if (!mappedCrop) {
        continue;
      }
      transformed.push({ ...suggestion, crop_rel: mappedCrop });
      continue;
    }
    transformed.push(suggestion);
  }

  return transformed;
}

function mapCropFromRotatedToOriginal(
  crop: NonNullable<PhotoEditSuggestion["crop_rel"]>,
  firstAngle: QuarterTurnAngle,
): PhotoEditSuggestion["crop_rel"] | null {
  const corners = [
    { x: crop.x, y: crop.y },
    { x: crop.x + crop.width, y: crop.y },
    { x: crop.x, y: crop.y + crop.height },
    { x: crop.x + crop.width, y: crop.y + crop.height },
  ];
  const mappedCorners = corners.map((corner) =>
    mapRotatedPointToOriginal(corner.x, corner.y, firstAngle),
  );
  const xs = mappedCorners.map((point) => point.x);
  const ys = mappedCorners.map((point) => point.y);
  const minX = clamp01(Math.min(...xs));
  const maxX = clamp01(Math.max(...xs));
  const minY = clamp01(Math.min(...ys));
  const maxY = clamp01(Math.max(...ys));
  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { x: minX, y: minY, width, height };
}

function mapRotatedPointToOriginal(
  x: number,
  y: number,
  firstAngle: QuarterTurnAngle,
): { x: number; y: number } {
  if (firstAngle === 90) {
    return { x: y, y: 1 - x };
  }
  if (firstAngle === 180) {
    return { x: 1 - x, y: 1 - y };
  }
  return { x: 1 - y, y: x };
}

function mergeNonRotateSuggestions(
  preferred: PhotoAnalysisOutput["edit_suggestions"],
  fallback: PhotoAnalysisOutput["edit_suggestions"],
): NonNullable<PhotoAnalysisOutput["edit_suggestions"]> {
  const preferredList = Array.isArray(preferred) ? preferred : [];
  const fallbackList = Array.isArray(fallback) ? fallback : [];
  const merged = [...preferredList];

  const hasPreferredCrop = preferredList.some((item) => item.edit_type === "crop");
  if (!hasPreferredCrop) {
    merged.push(...fallbackList.filter((item) => item.edit_type === "crop"));
  }

  merged.push(...fallbackList.filter((item) => item.edit_type === "straighten"));
  return dedupeSuggestions(merged);
}

function buildMergedRotationSuggestion(
  firstPass: PhotoAnalysisOutput,
  secondPass: PhotoAnalysisOutput,
  firstAngle: QuarterTurnAngle,
  secondResidualAngle: QuarterTurnAngle | null,
  correctedAngle: QuarterTurnAngle,
): PhotoEditSuggestion {
  const firstRotate = pickBestRotateSuggestion(firstPass.edit_suggestions);
  const secondRotate = pickBestRotateSuggestion(secondPass.edit_suggestions);
  const confidenceCandidates = [
    firstRotate?.confidence,
    secondRotate?.confidence,
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const confidence =
    confidenceCandidates.length > 0
      ? Math.max(...confidenceCandidates)
      : firstRotate?.confidence ?? null;
  const residualText =
    secondResidualAngle === null ? "none" : `${secondResidualAngle}\u00b0 clockwise`;

  return {
    edit_type: "rotate",
    priority: firstRotate?.priority ?? "high",
    reason:
      `Two-pass orientation consistency check: first pass ${firstAngle}\u00b0 clockwise, ` +
      `second-pass residual ${residualText}.`,
    confidence: confidence ?? null,
    auto_apply_safe: true,
    rotation: { angle_degrees_clockwise: correctedAngle },
  };
}

function pickBestRotateSuggestion(
  suggestions: PhotoAnalysisOutput["edit_suggestions"],
): PhotoEditSuggestion | null {
  if (!Array.isArray(suggestions)) {
    return null;
  }
  const rotate = suggestions.filter(
    (item) =>
      item.edit_type === "rotate" &&
      (item.rotation?.angle_degrees_clockwise === 90 ||
        item.rotation?.angle_degrees_clockwise === 180 ||
        item.rotation?.angle_degrees_clockwise === 270),
  );
  if (rotate.length === 0) {
    return null;
  }
  rotate.sort((a, b) => {
    const confidenceA = typeof a.confidence === "number" ? a.confidence : -1;
    const confidenceB = typeof b.confidence === "number" ? b.confidence : -1;
    return confidenceB - confidenceA;
  });
  return rotate[0];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

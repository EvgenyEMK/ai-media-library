/**
 * User-facing titles for the Background operations "AI model download" card.
 * Keep wording understandable without ML jargon (no raw ONNX filenames in the title).
 *
 * Title format: `AI model download - <purpose>`
 *
 * Purposes returned (suffix after the hyphen):
 * - Face detection and recognition — bundled startup (ArcFace + detector + optional aux).
 * - Face detection — face detector variants (RetinaFace / YOLO12).
 * - Face recognition — ArcFace embedding weights (`w600k_r50.onnx`).
 * - Image orientation — wrong-way-up / rotation classifier (`deep-image-orientation.onnx`).
 * - Face shape details — landmark refinement (`pfld_ghostone.onnx`).
 * - Age and gender (faces) — optional face attributes (`age-gender.onnx`).
 * - AI models — fallback when the download type cannot be inferred.
 */

const TITLE_PREFIX = "AI model download";

export interface FaceModelDownloadTitleInput {
  filename: string | null;
  message: string;
}

function normalizeFilename(filename: string | null): string | null {
  if (!filename) return null;
  const trimmed = filename.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
}

function normalizeMessage(message: string): string {
  return message.trim().toLowerCase();
}

function purposeFromFilename(filename: string | null): string | null {
  const name = normalizeFilename(filename);
  if (!name) return null;

  if (name === "w600k_r50.onnx") {
    return "Face recognition";
  }
  if (
    name === "retinaface_mv2.onnx" ||
    (name.startsWith("yolov12") && name.endsWith("-face.onnx"))
  ) {
    return "Face detection";
  }
  if (name === "deep-image-orientation.onnx") {
    return "Image orientation";
  }
  if (name === "pfld_ghostone.onnx") {
    return "Face shape details";
  }
  if (name === "age-gender.onnx") {
    return "Age and gender (faces)";
  }

  return null;
}

function purposeFromMessage(message: string): string | null {
  const m = normalizeMessage(message);

  if (m.includes("face detection and recognition")) {
    return "Face detection and recognition";
  }
  if (m.includes("face detector model")) {
    return "Face detection";
  }
  if (m.includes("orientation model")) {
    return "Image orientation";
  }
  if (m.includes("landmarks model")) {
    return "Face shape details";
  }
  if (m.includes("age-gender model")) {
    return "Age and gender (faces)";
  }

  return null;
}

/** Full heading text shown above the progress bar. */
export function getFaceModelDownloadCardTitle(input: FaceModelDownloadTitleInput): string {
  const fromFile = purposeFromFilename(input.filename);
  if (fromFile) {
    return `${TITLE_PREFIX} - ${fromFile}`;
  }
  const fromMsg = purposeFromMessage(input.message);
  if (fromMsg) {
    return `${TITLE_PREFIX} - ${fromMsg}`;
  }
  return `${TITLE_PREFIX} - AI models`;
}

export function getFaceModelDownloadCardAriaLabel(input: FaceModelDownloadTitleInput): string {
  return getFaceModelDownloadCardTitle(input);
}

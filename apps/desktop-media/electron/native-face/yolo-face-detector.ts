/**
 * YOLO-face ONNX detector for yolov11/yolov12 models from akanametov/yolo-face.
 *
 * **Inputs:** NCHW RGB float32 in [0,1], typically `[1, 3, 640, 640]` (input name varies;
 * we use the session’s first float input).
 *
 * **Outputs** (two layouts seen in the wild):
 *
 * 1. **Pose / channel-major** `[1, 20, N]` — cx, cy, w, h, conf, then 5×(x, y, vis) keypoints
 *    in letterbox space; keypoint order matches RetinaFace.
 * 2. **End-to-end NMS** `[1, N, 6]` or `[1, 6, N]` — `x1, y1, x2, y2, score, class_id` in
 *    letterbox space (often 300 rows; padded rows have score 0). No keypoints: we synthesize
 *    approximate 5-point landmarks from each box for downstream orientation heuristics.
 *
 * Pre-processing: letterbox resize + pad to 640×640, then map boxes back to the original image.
 */

import * as ort from "onnxruntime-node";
import {
  DEFAULT_FACE_DETECTION_SETTINGS,
  type FaceDetectionBox,
  type FaceDetectionOutput,
  type FaceDetectionSettings,
  type FaceDetectorModelId,
} from "../../src/shared/ipc";
import {
  buildProviderRawBoundingBoxReference,
  clamp,
  fromXyxyPixelBox,
  type FaceBoundingBoxLike,
  type FaceLandmarkFeature,
} from "@emk/shared-contracts";
import { loadImageRgb, resizeRgb, type RawImage } from "./image-utils";
import { getModelPath, isModelDownloaded } from "./model-manager";
import {
  decodeChannelMajorPose20,
  decodeEnd2EndSix,
  runNmsOnDecoded,
  type LetterboxMapping,
} from "./yolo-output-decode";
import { classifyFaceSubjectRoles } from "./subject-role";
import type { FaceDetector, NativeDetectParams } from "./detector";

const YOLO_INPUT_SIZE = 640;
const YOLO_INPUT_NAME_CANDIDATES = ["images", "input", "images.0"] as const;
const YOLO_PAD_VALUE = 114;
const YOLO_DEFAULT_CONF = 0.35;
const YOLO_DEFAULT_NMS = 0.45;
const YOLO_MAX_POST_NMS = 750;

interface YoloSessionState {
  promise: Promise<ort.InferenceSession> | null;
  error: string | null;
}

const sessions = new Map<FaceDetectorModelId, YoloSessionState>();

function getState(id: FaceDetectorModelId): YoloSessionState {
  let state = sessions.get(id);
  if (!state) {
    state = { promise: null, error: null };
    sessions.set(id, state);
  }
  return state;
}

function modelFilenameFor(id: FaceDetectorModelId): string {
  switch (id) {
    case "yolov11n-face":
      return "yolov11n-face.onnx";
    case "yolov12n-face":
      return "yolov12n-face.onnx";
    case "yolov12s-face":
      return "yolov12s-face.onnx";
    case "yolov12m-face":
      return "yolov12m-face.onnx";
    case "yolov12l-face":
      return "yolov12l-face.onnx";
    default:
      throw new Error(`Unsupported YOLO face detector id: ${id}`);
  }
}

function createSession(id: FaceDetectorModelId): Promise<ort.InferenceSession> {
  return ort.InferenceSession.create(getModelPath(modelFilenameFor(id)), {
    executionProviders: ["cpu"],
  });
}

async function getSession(id: FaceDetectorModelId): Promise<ort.InferenceSession> {
  const state = getState(id);
  if (!state.promise) {
    state.promise = createSession(id);
  }
  try {
    return await state.promise;
  } catch (err) {
    state.promise = null;
    state.error = err instanceof Error ? err.message : String(err);
    throw err;
  }
}

export function isYoloDetectorReady(id: FaceDetectorModelId): boolean {
  return isModelDownloaded(modelFilenameFor(id)) && getState(id).error === null;
}

export function getYoloDetectorError(id: FaceDetectorModelId): string | null {
  return getState(id).error;
}

export function resetYoloDetector(id: FaceDetectorModelId): void {
  const state = getState(id);
  state.promise = null;
  state.error = null;
}

function resolveYoloInputName(session: ort.InferenceSession): string {
  for (const name of YOLO_INPUT_NAME_CANDIDATES) {
    if (session.inputNames.includes(name)) {
      return name;
    }
  }
  const first = session.inputNames[0];
  if (first) {
    return first;
  }
  return "images";
}

interface LetterboxResult {
  tensor: Float32Array;
  scale: number;
  padX: number;
  padY: number;
  originalWidth: number;
  originalHeight: number;
}

/**
 * Letterbox an RGB image into a 640x640 NCHW float32 tensor in [0,1].
 */
function letterboxToTensor(rgb: RawImage): LetterboxResult {
  const { width: srcW, height: srcH } = rgb;
  const scale = Math.min(YOLO_INPUT_SIZE / srcW, YOLO_INPUT_SIZE / srcH);
  const newW = Math.max(1, Math.round(srcW * scale));
  const newH = Math.max(1, Math.round(srcH * scale));
  const padX = Math.floor((YOLO_INPUT_SIZE - newW) / 2);
  const padY = Math.floor((YOLO_INPUT_SIZE - newH) / 2);

  const resized = resizeRgb(rgb, newW, newH);

  const tensor = new Float32Array(3 * YOLO_INPUT_SIZE * YOLO_INPUT_SIZE);
  const plane = YOLO_INPUT_SIZE * YOLO_INPUT_SIZE;
  const padFloat = YOLO_PAD_VALUE / 255;
  tensor.fill(padFloat);

  for (let y = 0; y < newH; y++) {
    const dstY = y + padY;
    for (let x = 0; x < newW; x++) {
      const dstX = x + padX;
      const srcOff = (y * newW + x) * 3;
      const r = resized.data[srcOff] / 255;
      const g = resized.data[srcOff + 1] / 255;
      const b = resized.data[srcOff + 2] / 255;
      const dstPixel = dstY * YOLO_INPUT_SIZE + dstX;
      tensor[dstPixel] = r;
      tensor[plane + dstPixel] = g;
      tensor[plane * 2 + dstPixel] = b;
    }
  }

  return {
    tensor,
    scale,
    padX,
    padY,
    originalWidth: srcW,
    originalHeight: srcH,
  };
}

function parseEnvFloat(name: string): number | null {
  const raw = process.env[name];
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function resolveSettings(
  settings: FaceDetectionSettings | undefined,
): FaceDetectionSettings {
  const envConf = parseEnvFloat("EMK_DESKTOP_FACE_MIN_CONFIDENCE");
  const envRatio = parseEnvFloat("EMK_DESKTOP_FACE_MIN_BOX_SHORT_SIDE_RATIO");
  return {
    detectorModel:
      settings?.detectorModel ?? DEFAULT_FACE_DETECTION_SETTINGS.detectorModel,
    minConfidenceThreshold: clamp(
      settings?.minConfidenceThreshold ?? envConf ?? 0.5,
      0,
      1,
    ),
    minFaceBoxShortSideRatio: clamp(
      settings?.minFaceBoxShortSideRatio ?? envRatio ?? 0.05,
      0,
      1,
    ),
    faceBoxOverlapMergeRatio: clamp(
      settings?.faceBoxOverlapMergeRatio ?? 0.5,
      0,
      1,
    ),
    faceRecognitionSimilarityThreshold: clamp(
      settings?.faceRecognitionSimilarityThreshold ??
        DEFAULT_FACE_DETECTION_SETTINGS.faceRecognitionSimilarityThreshold,
      0,
      1,
    ),
    faceGroupPairwiseSimilarityThreshold: clamp(
      settings?.faceGroupPairwiseSimilarityThreshold ??
        DEFAULT_FACE_DETECTION_SETTINGS.faceGroupPairwiseSimilarityThreshold,
      0,
      1,
    ),
    faceGroupMinSize: Math.round(
      clamp(
        settings?.faceGroupMinSize ?? DEFAULT_FACE_DETECTION_SETTINGS.faceGroupMinSize,
        2,
        500,
      ),
    ),
    mainSubjectMinSizeRatioToLargest: clamp(
      settings?.mainSubjectMinSizeRatioToLargest ??
        DEFAULT_FACE_DETECTION_SETTINGS.mainSubjectMinSizeRatioToLargest,
      0,
      1,
    ),
    mainSubjectMinImageAreaRatio: clamp(
      settings?.mainSubjectMinImageAreaRatio ??
        DEFAULT_FACE_DETECTION_SETTINGS.mainSubjectMinImageAreaRatio,
      0,
      1,
    ),
    preserveTaggedFacesMinIoU: clamp(
      settings?.preserveTaggedFacesMinIoU ??
        DEFAULT_FACE_DETECTION_SETTINGS.preserveTaggedFacesMinIoU,
      0,
      1,
    ),
    keepUnmatchedTaggedFaces:
      settings?.keepUnmatchedTaggedFaces ??
      DEFAULT_FACE_DETECTION_SETTINGS.keepUnmatchedTaggedFaces,
  };
}

function passesFaceFilters(
  face: { bbox_xyxy: [number, number, number, number]; score: number },
  settings: FaceDetectionSettings,
  imgW: number,
  imgH: number,
): boolean {
  if (face.score < settings.minConfidenceThreshold) return false;

  const [x1, y1, x2, y2] = face.bbox_xyxy;
  const boxW = Math.max(0, x2 - x1);
  const boxH = Math.max(0, y2 - y1);
  const boxShort = Math.min(boxW, boxH);
  const imgShort = Math.min(imgW, imgH);
  if (imgShort <= 0) return true;
  return boxShort / imgShort >= settings.minFaceBoxShortSideRatio;
}

const LANDMARK_FEATURE_NAMES: FaceLandmarkFeature[] = [
  "left_eye",
  "right_eye",
  "nose",
  "left_mouth_corner",
  "right_mouth_corner",
];

function detectLandmarkFeatures(
  landmarks: Array<[number, number]>,
): FaceLandmarkFeature[] | null {
  if (!Array.isArray(landmarks) || landmarks.length < 5) return null;
  const features: FaceLandmarkFeature[] = [];
  for (let i = 0; i < 5; i++) {
    const pt = landmarks[i];
    if (
      Array.isArray(pt) &&
      pt.length >= 2 &&
      Number.isFinite(pt[0]) &&
      Number.isFinite(pt[1])
    ) {
      features.push(LANDMARK_FEATURE_NAMES[i]);
    }
  }
  return features.length > 0 ? features : null;
}

function toRawPixelBoundingBox(
  bbox: [number, number, number, number],
  imageSize: { width: number; height: number } | null,
): FaceBoundingBoxLike {
  const [x1, y1, x2, y2] = bbox;
  return {
    mp_x: x1,
    mp_y: y1,
    mp_width: Math.max(0, x2 - x1),
    mp_height: Math.max(0, y2 - y1),
    x: x1,
    y: y1,
    width: Math.max(0, x2 - x1),
    height: Math.max(0, y2 - y1),
    image_width: imageSize?.width,
    image_height: imageSize?.height,
  };
}

async function detectFacesYolo(
  id: FaceDetectorModelId,
  params: NativeDetectParams,
): Promise<FaceDetectionOutput> {
  const { imagePath, signal, settings } = params;
  const confThreshold = params.confThreshold ?? YOLO_DEFAULT_CONF;
  const nmsThreshold = params.nmsThreshold ?? YOLO_DEFAULT_NMS;

  if (signal?.aborted) throw new Error("Face detection cancelled");

  const session = await getSession(id);
  const image = await loadImageRgb(imagePath);
  const imgW = image.width;
  const imgH = image.height;

  if (signal?.aborted) throw new Error("Face detection cancelled");

  const letterbox = letterboxToTensor(image);
  const ortTensor = new ort.Tensor("float32", letterbox.tensor, [
    1,
    3,
    YOLO_INPUT_SIZE,
    YOLO_INPUT_SIZE,
  ]);

  const inputName = resolveYoloInputName(session);
  const feeds: Record<string, ort.Tensor> = { [inputName]: ortTensor };
  const results = await session.run(feeds);

  if (signal?.aborted) throw new Error("Face detection cancelled");

  const firstOutputName = session.outputNames[0];
  const outTensor = results[firstOutputName];
  const outData = outTensor.data as Float32Array;
  const dims = outTensor.dims;

  const lbMap: LetterboxMapping = {
    scale: letterbox.scale,
    padX: letterbox.padX,
    padY: letterbox.padY,
    imgW,
    imgH,
  };

  let decoded: ReturnType<typeof decodeChannelMajorPose20>;
  if (dims.length === 3 && dims[1] === 20 && typeof dims[2] === "number" && dims[2] > 0) {
    decoded = decodeChannelMajorPose20(outData, dims[2], confThreshold, lbMap);
  } else if (
    dims.length === 3 &&
    ((dims[2] === 6 && typeof dims[1] === "number" && dims[1] > 0) ||
      (dims[1] === 6 && typeof dims[2] === "number" && dims[2] > 0))
  ) {
    decoded = decodeEnd2EndSix(outData, dims, confThreshold, lbMap);
  } else {
    throw new Error(
      `Unsupported YOLO-face output shape [${dims.join(",")}]. ` +
        `Expected [1,20,N] (pose) or [1,N,6] / [1,6,N] (end-to-end boxes).`,
    );
  }

  const kept = runNmsOnDecoded(decoded, nmsThreshold, YOLO_MAX_POST_NMS);
  const pixelBoxes = decoded.pixelBoxes;
  const scores = decoded.scores;
  const pixelLandmarks = decoded.pixelLandmarks;

  const resolvedSettings = resolveSettings(settings);
  const rawFaces: FaceDetectionBox[] = kept
    .map((k) => {
      const bbox: [number, number, number, number] = [
        pixelBoxes[k * 4],
        pixelBoxes[k * 4 + 1],
        pixelBoxes[k * 4 + 2],
        pixelBoxes[k * 4 + 3],
      ];
      const landmarks: Array<[number, number]> = [];
      for (let p = 0; p < 5; p++) {
        landmarks.push([
          pixelLandmarks[k * 10 + p * 2],
          pixelLandmarks[k * 10 + p * 2 + 1],
        ]);
      }
      return { bbox_xyxy: bbox, score: scores[k], landmarks_5: landmarks };
    })
    .filter((face) => passesFaceFilters(face, resolvedSettings, imgW, imgH));

  const imageSize = { width: imgW, height: imgH };
  const faces = classifyFaceSubjectRoles(rawFaces, imageSize, {
    minSizeRatioToLargest: resolvedSettings.mainSubjectMinSizeRatioToLargest,
    minImageAreaRatio: resolvedSettings.mainSubjectMinImageAreaRatio,
  });

  return {
    faceCount: faces.length,
    faces,
    peopleBoundingBoxes: faces.map((face) => ({
      person_category: null,
      gender: null,
      person_bounding_box: null,
      person_face_bounding_box: fromXyxyPixelBox(face.bbox_xyxy, imageSize),
      provider_raw_bounding_box: buildProviderRawBoundingBoxReference(
        `${id}-native`,
        toRawPixelBoundingBox(face.bbox_xyxy, imageSize),
      ),
      azureFaceAttributes: null,
      detected_features: detectLandmarkFeatures(face.landmarks_5),
    })),
    imageSizeForBoundingBoxes: imageSize,
    modelInfo: {
      service: `${id}-native`,
      modelName: id,
      modelPath: getModelPath(modelFilenameFor(id)),
      timestamp: new Date().toISOString(),
    },
  };
}

export function createYoloFaceDetector(id: FaceDetectorModelId): FaceDetector {
  return {
    id,
    modelFilename: modelFilenameFor(id),
    isReady: () => isYoloDetectorReady(id),
    reset: () => resetYoloDetector(id),
    detect: (params) => detectFacesYolo(id, params),
  };
}

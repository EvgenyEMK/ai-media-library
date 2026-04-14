import * as ort from "onnxruntime-node";
import {
  DEFAULT_FACE_DETECTION_SETTINGS,
  type FaceDetectionOutput,
  type FaceDetectionSettings,
} from "../../src/shared/ipc";
import {
  buildProviderRawBoundingBoxReference,
  clamp,
  fromXyxyPixelBox,
  type FaceBoundingBoxLike,
  type FaceLandmarkFeature,
} from "@emk/shared-contracts";
import {
  BGR_MEAN,
  ONNX_INPUT_NAME,
  RETINAFACE_DEFAULT_CONF_THRESHOLD,
  RETINAFACE_DEFAULT_NMS_THRESHOLD,
  RETINAFACE_DEFAULT_POST_NMS_TOPK,
  RETINAFACE_DEFAULT_PRE_NMS_TOPK,
  RETINAFACE_MOBILENETV2,
} from "./config";
import { generatePriors } from "./prior-box";
import { decodeBoxes, decodeLandmarks } from "./decode";
import { nms } from "./nms";
import { loadImageRgb, rgbToBgrFloat32CHW } from "./image-utils";
import { getModelPath, isModelDownloaded } from "./model-manager";

const RETINAFACE_MODEL_FILE = "retinaface_mv2.onnx";
const config = RETINAFACE_MOBILENETV2;

let sessionPromise: Promise<ort.InferenceSession> | null = null;
let loadError: string | null = null;

function createSession(): Promise<ort.InferenceSession> {
  return ort.InferenceSession.create(getModelPath(RETINAFACE_MODEL_FILE), {
    executionProviders: ["cpu"],
  });
}

async function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = createSession();
  }
  try {
    return await sessionPromise;
  } catch (err) {
    sessionPromise = null;
    loadError = err instanceof Error ? err.message : String(err);
    throw err;
  }
}

export function isNativeDetectorReady(): boolean {
  return isModelDownloaded(RETINAFACE_MODEL_FILE) && loadError === null;
}

export function getNativeDetectorError(): string | null {
  return loadError;
}

export function resetNativeDetector(): void {
  sessionPromise = null;
  loadError = null;
}

export interface NativeDetectParams {
  imagePath: string;
  signal?: AbortSignal;
  settings?: FaceDetectionSettings;
  confThreshold?: number;
  nmsThreshold?: number;
}

export async function detectFacesNative(
  params: NativeDetectParams,
): Promise<FaceDetectionOutput> {
  const {
    imagePath,
    signal,
    settings,
    confThreshold = RETINAFACE_DEFAULT_CONF_THRESHOLD,
    nmsThreshold = RETINAFACE_DEFAULT_NMS_THRESHOLD,
  } = params;

  if (signal?.aborted) throw new Error("Face detection cancelled");

  const session = await getSession();
  const image = await loadImageRgb(imagePath);
  const { width: imgW, height: imgH } = image;

  if (signal?.aborted) throw new Error("Face detection cancelled");

  const inputTensor = rgbToBgrFloat32CHW(image, BGR_MEAN);
  const ortTensor = new ort.Tensor("float32", inputTensor, [1, 3, imgH, imgW]);

  const feeds: Record<string, ort.Tensor> = { [ONNX_INPUT_NAME]: ortTensor };
  const results = await session.run(feeds);

  if (signal?.aborted) throw new Error("Face detection cancelled");

  const outputNames = session.outputNames;
  const locData = results[outputNames[0]].data as Float32Array;
  const confData = results[outputNames[1]].data as Float32Array;
  const landmarkData = results[outputNames[2]].data as Float32Array;

  const priors = generatePriors(imgW, imgH, config);
  const numPriors = priors.length / 4;

  const decodedBoxes = decodeBoxes(locData, priors, config.variance);
  const decodedLandmarks = decodeLandmarks(landmarkData, priors, config.variance);

  // Extract face scores (column 1 of the 2-class conf output)
  const scores = new Float32Array(numPriors);
  for (let i = 0; i < numPriors; i++) {
    scores[i] = confData[i * 2 + 1];
  }

  // Filter by confidence threshold and collect top-k before NMS
  const candidates: number[] = [];
  for (let i = 0; i < numPriors; i++) {
    if (scores[i] > confThreshold) {
      candidates.push(i);
    }
  }

  candidates.sort((a, b) => scores[b] - scores[a]);
  const preNmsIndices = candidates.slice(0, RETINAFACE_DEFAULT_PRE_NMS_TOPK);

  // Scale boxes and landmarks to pixel coordinates
  const nBoxes = preNmsIndices.length;
  const pixelBoxes = new Float32Array(nBoxes * 4);
  const pixelLandmarks = new Float32Array(nBoxes * 10);
  const filteredScores = new Float32Array(nBoxes);

  for (let k = 0; k < nBoxes; k++) {
    const i = preNmsIndices[k];
    pixelBoxes[k * 4] = decodedBoxes[i * 4] * imgW;
    pixelBoxes[k * 4 + 1] = decodedBoxes[i * 4 + 1] * imgH;
    pixelBoxes[k * 4 + 2] = decodedBoxes[i * 4 + 2] * imgW;
    pixelBoxes[k * 4 + 3] = decodedBoxes[i * 4 + 3] * imgH;

    for (let p = 0; p < 5; p++) {
      pixelLandmarks[k * 10 + p * 2] = decodedLandmarks[i * 10 + p * 2] * imgW;
      pixelLandmarks[k * 10 + p * 2 + 1] = decodedLandmarks[i * 10 + p * 2 + 1] * imgH;
    }

    filteredScores[k] = scores[i];
  }

  const kept = nms(pixelBoxes, filteredScores, nmsThreshold);
  const postNmsKept = kept.slice(0, RETINAFACE_DEFAULT_POST_NMS_TOPK);

  const resolvedSettings = resolveSettings(settings);
  const faces = postNmsKept
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
      return { bbox_xyxy: bbox, score: filteredScores[k], landmarks_5: landmarks };
    })
    .filter((face) =>
      passesFaceFilters(face, resolvedSettings, imgW, imgH),
    );

  const imageSize = { width: imgW, height: imgH };
  return {
    faceCount: faces.length,
    faces,
    peopleBoundingBoxes: faces.map((face) => ({
      person_category: null,
      gender: null,
      person_bounding_box: null,
      person_face_bounding_box: fromXyxyPixelBox(face.bbox_xyxy, imageSize),
      provider_raw_bounding_box: buildProviderRawBoundingBoxReference(
        "retinaface-native",
        toRawPixelBoundingBox(face.bbox_xyxy, imageSize),
      ),
      azureFaceAttributes: null,
      detected_features: detectLandmarkFeatures(face.landmarks_5),
    })),
    imageSizeForBoundingBoxes: imageSize,
    modelInfo: {
      service: "retinaface-native",
      modelName: "retinaface_mv2",
      modelPath: getModelPath(RETINAFACE_MODEL_FILE),
      timestamp: new Date().toISOString(),
    },
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

function resolveSettings(
  settings: FaceDetectionSettings | undefined,
): FaceDetectionSettings {
  const envConf = parseEnvFloat("EMK_DESKTOP_FACE_MIN_CONFIDENCE");
  const envRatio = parseEnvFloat("EMK_DESKTOP_FACE_MIN_BOX_SHORT_SIDE_RATIO");
  const envOverlap = parseEnvFloat("EMK_DESKTOP_FACE_BOX_OVERLAP_MERGE_RATIO");
  return {
    minConfidenceThreshold: clamp(
      settings?.minConfidenceThreshold ?? envConf ?? 0.75,
      0,
      1,
    ),
    minFaceBoxShortSideRatio: clamp(
      settings?.minFaceBoxShortSideRatio ?? envRatio ?? 0.05,
      0,
      1,
    ),
    faceBoxOverlapMergeRatio: clamp(
      settings?.faceBoxOverlapMergeRatio ?? envOverlap ?? 0.5,
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
  };
}

function parseEnvFloat(name: string): number | null {
  const raw = process.env[name];
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
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
  if (!Array.isArray(landmarks) || landmarks.length < 5) {
    return null;
  }
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

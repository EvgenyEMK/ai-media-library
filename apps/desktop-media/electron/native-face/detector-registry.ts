import type { FaceDetectorModelId } from "../../src/shared/ipc";
import type { FaceDetector } from "./detector";
import { retinafaceDetector } from "./retinaface-detector";
import { createYoloFaceDetector } from "./yolo-face-detector";

const DETECTORS: Record<FaceDetectorModelId, FaceDetector> = {
  retinaface: retinafaceDetector,
  "yolov11n-face": createYoloFaceDetector("yolov11n-face"),
  "yolov12n-face": createYoloFaceDetector("yolov12n-face"),
  "yolov12s-face": createYoloFaceDetector("yolov12s-face"),
  "yolov12m-face": createYoloFaceDetector("yolov12m-face"),
  "yolov12l-face": createYoloFaceDetector("yolov12l-face"),
};

export function getDetector(id: FaceDetectorModelId): FaceDetector {
  const detector = DETECTORS[id];
  if (!detector) {
    throw new Error(`Unknown face detector id: ${id}`);
  }
  return detector;
}

export function listDetectorIds(): FaceDetectorModelId[] {
  return Object.keys(DETECTORS) as FaceDetectorModelId[];
}

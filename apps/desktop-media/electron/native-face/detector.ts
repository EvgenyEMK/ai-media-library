import type {
  FaceDetectionOutput,
  FaceDetectionSettings,
  FaceDetectorModelId,
} from "../../src/shared/ipc";

export interface NativeDetectParams {
  imagePath: string;
  signal?: AbortSignal;
  settings?: FaceDetectionSettings;
  confThreshold?: number;
  nmsThreshold?: number;
}

export interface FaceDetector {
  readonly id: FaceDetectorModelId;
  /** ONNX filename relative to the models directory. */
  readonly modelFilename: string;
  /** True when the ONNX weights are on disk and the session is loadable. */
  isReady(): boolean;
  /** Clears any cached session so the next call re-loads. */
  reset(): void;
  /** Run inference and produce a `FaceDetectionOutput`. */
  detect(params: NativeDetectParams): Promise<FaceDetectionOutput>;
}

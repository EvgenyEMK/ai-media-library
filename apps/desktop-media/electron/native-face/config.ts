export interface RetinaFaceConfig {
  minSizes: number[][];
  steps: number[];
  variance: [number, number];
  clipPriors: boolean;
}

export const RETINAFACE_MOBILENETV2: RetinaFaceConfig = {
  minSizes: [
    [16, 32],
    [64, 128],
    [256, 512],
  ],
  steps: [8, 16, 32],
  variance: [0.1, 0.2],
  clipPriors: false,
};

/** BGR channel means subtracted during preprocessing (Caffe-style). */
export const BGR_MEAN: [number, number, number] = [104, 117, 123];

export const ONNX_INPUT_NAME = "input";

export const RETINAFACE_DEFAULT_CONF_THRESHOLD = 0.3;
export const RETINAFACE_DEFAULT_NMS_THRESHOLD = 0.4;
export const RETINAFACE_DEFAULT_PRE_NMS_TOPK = 5000;
export const RETINAFACE_DEFAULT_POST_NMS_TOPK = 200;

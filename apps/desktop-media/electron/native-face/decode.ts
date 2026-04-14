/**
 * Decode model output deltas into xyxy bounding boxes using prior anchors.
 * Matches the Python `decode()` from yakhyo/retinaface-pytorch.
 *
 * @param loc     Raw model output [N, 4] as flat Float32Array
 * @param priors  Prior boxes [N, 4] (cx, cy, w, h) normalized
 * @param variance [v0, v1] — typically [0.1, 0.2]
 * @returns Float32Array [N, 4] with xyxy in normalized [0,1] coords
 */
export function decodeBoxes(
  loc: Float32Array,
  priors: Float32Array,
  variance: [number, number],
): Float32Array {
  const n = priors.length / 4;
  const boxes = new Float32Array(n * 4);
  const [v0, v1] = variance;

  for (let i = 0; i < n; i++) {
    const pOff = i * 4;
    const pcx = priors[pOff];
    const pcy = priors[pOff + 1];
    const pw = priors[pOff + 2];
    const ph = priors[pOff + 3];

    const lOff = i * 4;
    const cx = pcx + loc[lOff] * v0 * pw;
    const cy = pcy + loc[lOff + 1] * v0 * ph;
    const w = pw * Math.exp(loc[lOff + 2] * v1);
    const h = ph * Math.exp(loc[lOff + 3] * v1);

    const bOff = i * 4;
    boxes[bOff] = cx - w / 2;
    boxes[bOff + 1] = cy - h / 2;
    boxes[bOff + 2] = cx + w / 2;
    boxes[bOff + 3] = cy + h / 2;
  }

  return boxes;
}

/**
 * Decode landmark predictions using prior anchors.
 * Matches the Python `decode_landmarks()` from yakhyo/retinaface-pytorch.
 *
 * @param raw     Raw model output [N, 10] as flat Float32Array
 * @param priors  Prior boxes [N, 4] (cx, cy, w, h) normalized
 * @param variance [v0, v1]
 * @returns Float32Array [N, 10] with landmark coords in normalized [0,1]
 */
export function decodeLandmarks(
  raw: Float32Array,
  priors: Float32Array,
  variance: [number, number],
): Float32Array {
  const n = priors.length / 4;
  const landmarks = new Float32Array(n * 10);
  const v0 = variance[0];

  for (let i = 0; i < n; i++) {
    const pOff = i * 4;
    const pcx = priors[pOff];
    const pcy = priors[pOff + 1];
    const pw = priors[pOff + 2];
    const ph = priors[pOff + 3];

    const rOff = i * 10;
    const lOff = i * 10;
    for (let p = 0; p < 5; p++) {
      landmarks[lOff + p * 2] = pcx + raw[rOff + p * 2] * v0 * pw;
      landmarks[lOff + p * 2 + 1] = pcy + raw[rOff + p * 2 + 1] * v0 * ph;
    }
  }

  return landmarks;
}

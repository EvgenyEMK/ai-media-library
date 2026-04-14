/**
 * Greedy non-maximum suppression with VOC-style (+1) area calculation.
 * Matches the Python `nms()` from yakhyo/retinaface-pytorch.
 *
 * @param boxes   [N, 4] xyxy in pixel coords (flat Float32Array)
 * @param scores  [N] confidence scores
 * @param threshold IoU threshold for suppression
 * @returns Array of kept indices
 */
export function nms(
  boxes: Float32Array,
  scores: Float32Array,
  threshold: number,
): number[] {
  const n = scores.length;

  const indices = Array.from({ length: n }, (_, i) => i);
  indices.sort((a, b) => scores[b] - scores[a]);

  const areas = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const off = i * 4;
    areas[i] = (boxes[off + 2] - boxes[off] + 1) * (boxes[off + 3] - boxes[off + 1] + 1);
  }

  const suppressed = new Uint8Array(n);
  const kept: number[] = [];

  for (const i of indices) {
    if (suppressed[i]) continue;
    kept.push(i);

    const ix1 = boxes[i * 4];
    const iy1 = boxes[i * 4 + 1];
    const ix2 = boxes[i * 4 + 2];
    const iy2 = boxes[i * 4 + 3];

    for (const j of indices) {
      if (suppressed[j] || j === i) continue;

      const jx1 = boxes[j * 4];
      const jy1 = boxes[j * 4 + 1];
      const jx2 = boxes[j * 4 + 2];
      const jy2 = boxes[j * 4 + 3];

      const interW = Math.max(0, Math.min(ix2, jx2) - Math.max(ix1, jx1) + 1);
      const interH = Math.max(0, Math.min(iy2, jy2) - Math.max(iy1, jy1) + 1);
      const inter = interW * interH;
      const iou = inter / (areas[i] + areas[j] - inter);

      if (iou > threshold) {
        suppressed[j] = 1;
      }
    }
  }

  return kept;
}

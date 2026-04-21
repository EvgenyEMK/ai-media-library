/**
 * Intersection-over-Union helpers for face bounding boxes.
 *
 * Supports pixel-xyxy boxes and scale normalization between different
 * reference image sizes, so a box saved with one image size can be
 * compared against a newly-detected box expressed in another size.
 */

export interface PixelXyxyBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ScaledBoxInput {
  x: number;
  y: number;
  width: number;
  height: number;
  refWidth?: number | null;
  refHeight?: number | null;
}

export function boxArea(box: PixelXyxyBox): number {
  const w = Math.max(0, box.x2 - box.x1);
  const h = Math.max(0, box.y2 - box.y1);
  return w * h;
}

export function iouXyxy(a: PixelXyxyBox, b: PixelXyxyBox): number {
  const interX1 = Math.max(a.x1, b.x1);
  const interY1 = Math.max(a.y1, b.y1);
  const interX2 = Math.min(a.x2, b.x2);
  const interY2 = Math.min(a.y2, b.y2);
  const interW = Math.max(0, interX2 - interX1);
  const interH = Math.max(0, interY2 - interY1);
  const inter = interW * interH;
  if (inter <= 0) return 0;
  const union = boxArea(a) + boxArea(b) - inter;
  if (union <= 0) return 0;
  return inter / union;
}

/**
 * Rescale a box recorded with its own reference image size into a target
 * image size. When either reference is missing the box is returned as-is
 * (assumed to already share the target coordinate space).
 */
export function rescaleBoxToImageSize(
  box: ScaledBoxInput,
  target: { width: number; height: number } | null,
): PixelXyxyBox {
  const { x, y, width, height, refWidth, refHeight } = box;
  if (
    target &&
    typeof refWidth === "number" &&
    typeof refHeight === "number" &&
    refWidth > 0 &&
    refHeight > 0 &&
    (refWidth !== target.width || refHeight !== target.height)
  ) {
    const sx = target.width / refWidth;
    const sy = target.height / refHeight;
    return {
      x1: x * sx,
      y1: y * sy,
      x2: (x + width) * sx,
      y2: (y + height) * sy,
    };
  }
  return { x1: x, y1: y, x2: x + width, y2: y + height };
}

/**
 * Greedy 1-to-1 matching between new and old boxes by descending IoU.
 * Returns a map of newIndex -> matched oldIndex (omitted when no match
 * passes the threshold). Each old box can match at most one new box.
 */
export function greedyMatchBoxesByIou<N, O>(
  newBoxes: Array<{ item: N; box: PixelXyxyBox }>,
  oldBoxes: Array<{ item: O; box: PixelXyxyBox }>,
  minIou: number,
): Map<number, { oldIndex: number; iou: number }> {
  const pairs: Array<{ newIndex: number; oldIndex: number; iou: number }> = [];
  for (let i = 0; i < newBoxes.length; i++) {
    for (let j = 0; j < oldBoxes.length; j++) {
      const iou = iouXyxy(newBoxes[i].box, oldBoxes[j].box);
      if (iou >= minIou) {
        pairs.push({ newIndex: i, oldIndex: j, iou });
      }
    }
  }
  pairs.sort((a, b) => b.iou - a.iou);

  const usedNew = new Set<number>();
  const usedOld = new Set<number>();
  const matches = new Map<number, { oldIndex: number; iou: number }>();
  for (const pair of pairs) {
    if (usedNew.has(pair.newIndex) || usedOld.has(pair.oldIndex)) continue;
    matches.set(pair.newIndex, { oldIndex: pair.oldIndex, iou: pair.iou });
    usedNew.add(pair.newIndex);
    usedOld.add(pair.oldIndex);
  }
  return matches;
}

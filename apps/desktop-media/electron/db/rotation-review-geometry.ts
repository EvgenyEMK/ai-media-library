export type QuarterTurnAngle = 90 | 180 | 270;

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface RotatedFaceBox {
  box: FaceBox;
  ref: ImageDimensions;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeBox(box: FaceBox, ref: ImageDimensions): FaceBox {
  const x1 = clamp(box.x, 0, ref.width);
  const y1 = clamp(box.y, 0, ref.height);
  const x2 = clamp(box.x + box.width, 0, ref.width);
  const y2 = clamp(box.y + box.height, 0, ref.height);
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

export function rotateDimensionsQuarterTurn(
  ref: ImageDimensions,
  angleClockwise: QuarterTurnAngle,
): ImageDimensions {
  return angleClockwise === 180 ? ref : { width: ref.height, height: ref.width };
}

export function mapAabbQuarterTurn(
  box: FaceBox,
  ref: ImageDimensions,
  angleClockwise: QuarterTurnAngle,
): RotatedFaceBox {
  const source = sanitizeBox(box, ref);
  if (angleClockwise === 90) {
    return {
      box: {
        x: ref.height - source.y - source.height,
        y: source.x,
        width: source.height,
        height: source.width,
      },
      ref: { width: ref.height, height: ref.width },
    };
  }
  if (angleClockwise === 180) {
    return {
      box: {
        x: ref.width - source.x - source.width,
        y: ref.height - source.y - source.height,
        width: source.width,
        height: source.height,
      },
      ref,
    };
  }
  return {
    box: {
      x: source.y,
      y: ref.width - source.x - source.width,
      width: source.height,
      height: source.width,
    },
    ref: { width: ref.height, height: ref.width },
  };
}

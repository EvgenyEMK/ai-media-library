import {
  mapAabbQuarterTurn,
  rotateDimensionsQuarterTurn,
  type ImageDimensions,
  type QuarterTurnAngle,
} from "./rotation-review-geometry";

export interface MetadataBoundingBox {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  image_width?: number;
  image_height?: number;
  x_min?: number;
  y_min?: number;
  x_max?: number;
  y_max?: number;
  mp_x?: number;
  mp_y?: number;
  mp_width?: number;
  mp_height?: number;
  [key: string]: unknown;
}

const NORMALIZED_BOX_REF: ImageDimensions = { width: 1000, height: 1000 };

const PIXEL_BOX_KEY_SETS = [
  { x: "x", y: "y", width: "width", height: "height" },
  { x: "mp_x", y: "mp_y", width: "mp_width", height: "mp_height" },
] as const;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function mapMetadataBoundingBoxQuarterTurn(
  box: MetadataBoundingBox,
  ref: ImageDimensions,
  angleClockwise: QuarterTurnAngle,
): MetadataBoundingBox {
  const next: MetadataBoundingBox = { ...box };
  const nextRecord = next as Record<string, unknown>;
  let mappedPixelBox = false;

  for (const keys of PIXEL_BOX_KEY_SETS) {
    const originX = nextRecord[keys.x];
    const originY = nextRecord[keys.y];
    const width = nextRecord[keys.width];
    const height = nextRecord[keys.height];
    if (
      isFiniteNumber(originX) &&
      isFiniteNumber(originY) &&
      isFiniteNumber(width) &&
      isFiniteNumber(height)
    ) {
      const rotated = mapAabbQuarterTurn(
        { x: originX, y: originY, width, height },
        ref,
        angleClockwise,
      );
      nextRecord[keys.x] = rotated.box.x;
      nextRecord[keys.y] = rotated.box.y;
      nextRecord[keys.width] = rotated.box.width;
      nextRecord[keys.height] = rotated.box.height;
      mappedPixelBox = true;
    }
  }

  if (
    isFiniteNumber(next.x_min) &&
    isFiniteNumber(next.y_min) &&
    isFiniteNumber(next.x_max) &&
    isFiniteNumber(next.y_max)
  ) {
    const rotated = mapAabbQuarterTurn(
      {
        x: next.x_min,
        y: next.y_min,
        width: next.x_max - next.x_min,
        height: next.y_max - next.y_min,
      },
      NORMALIZED_BOX_REF,
      angleClockwise,
    );
    next.x_min = rotated.box.x;
    next.y_min = rotated.box.y;
    next.x_max = rotated.box.x + rotated.box.width;
    next.y_max = rotated.box.y + rotated.box.height;
  }

  if (mappedPixelBox || isFiniteNumber(next.image_width) || isFiniteNumber(next.image_height)) {
    const rotatedRef = rotateDimensionsQuarterTurn(ref, angleClockwise);
    next.image_width = rotatedRef.width;
    next.image_height = rotatedRef.height;
  }

  return next;
}

export type StoredBoundingBoxFormat = "normalized" | "pixel" | "unknown";

export interface CanonicalBoundingBox {
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
}

export interface ProviderRawBoundingBoxReference {
  provider_id: string;
  format: StoredBoundingBoxFormat | "unknown";
  box: CanonicalBoundingBox;
}

export type FacePersonCategory = "adult" | "child" | "baby";
export type FaceGender = "male" | "female" | "unknown" | "other";
export type FaceLandmarkFeature =
  | "left_eye"
  | "right_eye"
  | "nose"
  | "left_mouth_corner"
  | "right_mouth_corner";

export interface FaceBeingBoundingBox {
  person_category?: FacePersonCategory | null;
  gender?: FaceGender | null;
  person_bounding_box?: CanonicalBoundingBox | null;
  person_face_bounding_box?: CanonicalBoundingBox | null;
  provider_raw_bounding_box?: ProviderRawBoundingBoxReference | null;
  azureFaceAttributes?: Record<string, unknown> | null;
  detected_features?: FaceLandmarkFeature[] | null;
}

export interface FaceBoundingBoxLike {
  mp_x?: number;
  mp_y?: number;
  mp_width?: number;
  mp_height?: number;
  x_min?: number;
  y_min?: number;
  x_max?: number;
  y_max?: number;
  image_width?: number | null;
  image_height?: number | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

const NORMALIZED_RANGE = 1000;

export function clampNormalized(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(NORMALIZED_RANGE, Math.round(value)));
}

export function detectBoundingBoxFormat(source: FaceBoundingBoxLike): StoredBoundingBoxFormat {
  if (
    typeof source.mp_x === "number" ||
    typeof source.mp_y === "number" ||
    typeof source.mp_width === "number" ||
    typeof source.mp_height === "number"
  ) {
    return "pixel";
  }

  if (
    typeof source.x_min === "number" ||
    typeof source.y_min === "number" ||
    typeof source.x_max === "number" ||
    typeof source.y_max === "number"
  ) {
    return "normalized";
  }

  return "unknown";
}

export function buildCanonicalBoundingBox(source: FaceBoundingBoxLike): CanonicalBoundingBox {
  const imageWidth =
    typeof source.image_width === "number" && source.image_width > 0
      ? source.image_width
      : undefined;
  const imageHeight =
    typeof source.image_height === "number" && source.image_height > 0
      ? source.image_height
      : undefined;

  const { xMin, xMax, yMin, yMax } = deriveNormalizedCoordinates(source, imageWidth, imageHeight);
  const canonicalXMin = xMin ?? 0;
  const canonicalYMin = yMin ?? 0;

  const widthHint =
    imageWidth && typeof source.mp_width === "number"
      ? (source.mp_width / imageWidth) * NORMALIZED_RANGE
      : typeof source.width === "number"
        ? source.width > NORMALIZED_RANGE && imageWidth
          ? (source.width / imageWidth) * NORMALIZED_RANGE
          : source.width
        : undefined;

  const heightHint =
    imageHeight && typeof source.mp_height === "number"
      ? (source.mp_height / imageHeight) * NORMALIZED_RANGE
      : typeof source.height === "number"
        ? source.height > NORMALIZED_RANGE && imageHeight
          ? (source.height / imageHeight) * NORMALIZED_RANGE
          : source.height
        : undefined;

  let canonicalXMax =
    xMax !== undefined ? Math.max(xMax, canonicalXMin) : clampNormalized(canonicalXMin + (widthHint ?? 0));
  let canonicalYMax =
    yMax !== undefined ? Math.max(yMax, canonicalYMin) : clampNormalized(canonicalYMin + (heightHint ?? 0));

  if (canonicalXMax <= canonicalXMin && widthHint !== undefined && widthHint > 0) {
    canonicalXMax = clampNormalized(canonicalXMin + widthHint);
    if (canonicalXMax <= canonicalXMin) {
      canonicalXMax = clampNormalized(canonicalXMin + 1);
    }
  }

  if (canonicalYMax <= canonicalYMin && heightHint !== undefined && heightHint > 0) {
    canonicalYMax = clampNormalized(canonicalYMin + heightHint);
    if (canonicalYMax <= canonicalYMin) {
      canonicalYMax = clampNormalized(canonicalYMin + 1);
    }
  }

  const box: CanonicalBoundingBox = {
    x_min: canonicalXMin,
    y_min: canonicalYMin,
    x_max: canonicalXMax,
    y_max: canonicalYMax,
  };

  if (imageWidth) {
    box.image_width = imageWidth;
    const pixelLeft = (canonicalXMin / NORMALIZED_RANGE) * imageWidth;
    const pixelRight = (canonicalXMax / NORMALIZED_RANGE) * imageWidth;
    box.x = pixelLeft;
    box.width = Math.max(0, pixelRight - pixelLeft);
  }

  if (imageHeight) {
    box.image_height = imageHeight;
    const pixelTop = (canonicalYMin / NORMALIZED_RANGE) * imageHeight;
    const pixelBottom = (canonicalYMax / NORMALIZED_RANGE) * imageHeight;
    box.y = pixelTop;
    box.height = Math.max(0, pixelBottom - pixelTop);
  }

  return box;
}

export function buildProviderRawBoundingBoxReference(
  providerId: string | undefined,
  box: FaceBoundingBoxLike,
  explicitFormat?: StoredBoundingBoxFormat | null,
): ProviderRawBoundingBoxReference | null {
  if (!providerId) {
    return null;
  }
  const { image_width, image_height, ...rest } = box;
  const normalizedBox: CanonicalBoundingBox = { ...rest };
  if (typeof image_width === "number") {
    normalizedBox.image_width = image_width;
  }
  if (typeof image_height === "number") {
    normalizedBox.image_height = image_height;
  }
  return {
    provider_id: providerId,
    format: explicitFormat ?? detectBoundingBoxFormat(box),
    box: normalizedBox,
  };
}

export function fromXyxyPixelBox(
  bbox: [number, number, number, number],
  imageSize?: { width: number; height: number } | null,
): CanonicalBoundingBox {
  const [x1, y1, x2, y2] = bbox;
  const width = Math.max(0, x2 - x1);
  const height = Math.max(0, y2 - y1);
  return buildCanonicalBoundingBox({
    mp_x: x1,
    mp_y: y1,
    mp_width: width,
    mp_height: height,
    x: x1,
    y: y1,
    width,
    height,
    image_width: imageSize?.width,
    image_height: imageSize?.height,
  });
}

function deriveNormalizedCoordinates(
  box: FaceBoundingBoxLike,
  imageWidth: number | undefined,
  imageHeight: number | undefined,
) {
  let xMin = typeof box.x_min === "number" ? clampNormalized(box.x_min) : undefined;
  let xMax = typeof box.x_max === "number" ? clampNormalized(box.x_max) : undefined;
  let yMin = typeof box.y_min === "number" ? clampNormalized(box.y_min) : undefined;
  let yMax = typeof box.y_max === "number" ? clampNormalized(box.y_max) : undefined;

  if (
    (xMin === undefined || xMax === undefined || yMin === undefined || yMax === undefined) &&
    imageWidth &&
    imageHeight &&
    typeof box.mp_x === "number" &&
    typeof box.mp_y === "number"
  ) {
    const mpX = box.mp_x;
    const mpY = box.mp_y;
    const mpWidth = typeof box.mp_width === "number" ? box.mp_width : 0;
    const mpHeight = typeof box.mp_height === "number" ? box.mp_height : 0;

    if (xMin === undefined) {
      xMin = clampNormalized((mpX / imageWidth) * NORMALIZED_RANGE);
    }
    if (xMax === undefined) {
      xMax = clampNormalized(((mpX + mpWidth) / imageWidth) * NORMALIZED_RANGE);
    }
    if (yMin === undefined) {
      yMin = clampNormalized((mpY / imageHeight) * NORMALIZED_RANGE);
    }
    if (yMax === undefined) {
      yMax = clampNormalized(((mpY + mpHeight) / imageHeight) * NORMALIZED_RANGE);
    }
  }

  return { xMin, xMax, yMin, yMax };
}

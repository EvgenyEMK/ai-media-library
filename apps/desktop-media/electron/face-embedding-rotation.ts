export function transformFaceForRotatedEmbedding(params: {
  bbox: [number, number, number, number];
  landmarks: Array<[number, number]> | null;
  angle: 90 | 180 | 270;
  originalSize: { width: number; height: number };
}): { bbox: [number, number, number, number]; landmarks?: Array<[number, number]> } {
  const { bbox, landmarks, angle, originalSize } = params;
  const [x1, y1, x2, y2] = bbox;
  const p1 = transformOriginalPointToRotated(x1, y1, angle, originalSize);
  const p2 = transformOriginalPointToRotated(x2, y2, angle, originalSize);
  const transformedLandmarks = landmarks?.map(([x, y]) => {
    const p = transformOriginalPointToRotated(x, y, angle, originalSize);
    return [p.x, p.y] as [number, number];
  });
  return {
    bbox: [
      Math.min(p1.x, p2.x),
      Math.min(p1.y, p2.y),
      Math.max(p1.x, p2.x),
      Math.max(p1.y, p2.y),
    ],
    landmarks: transformedLandmarks,
  };
}

function transformOriginalPointToRotated(
  x: number,
  y: number,
  angleCw: 90 | 180 | 270,
  originalSize: { width: number; height: number },
): { x: number; y: number } {
  switch (angleCw) {
    case 90:
      return { x: originalSize.height - 1 - y, y: x };
    case 180:
      return { x: originalSize.width - 1 - x, y: originalSize.height - 1 - y };
    case 270:
      return { x: y, y: originalSize.width - 1 - x };
  }
}

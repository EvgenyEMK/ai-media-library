/**
 * Infer image orientation from RetinaFace 5-point landmarks.
 *
 * Standard 5-point landmark order (RetinaFace convention):
 *   [0] left eye, [1] right eye, [2] nose, [3] left mouth, [4] right mouth
 *
 * Coordinate system: pixel or normalised, y-axis points **down**.
 *
 * The relationship between the eye-midpoint and the nose is the primary
 * signal: in an upright photo the eyes are above the nose (eyeMidY < noseY).
 */

export type QuarterTurnAngle = 90 | 180 | 270;

export type FaceLandmarkOrientation = "upright" | "rotated_90_cw" | "rotated_180" | "rotated_270_cw";

export interface FaceLandmarkOrientationVote {
  orientation: FaceLandmarkOrientation;
  correctionAngleClockwise: QuarterTurnAngle | 0;
  confidence: number;
}

export interface FaceLandmarkRotationResult {
  orientation: FaceLandmarkOrientation;
  correctionAngleClockwise: QuarterTurnAngle | 0;
  confidence: number;
  faceCount: number;
  unanimousAgreement: boolean;
}

type Landmark5 = [number, number][];

const MIN_FACE_LANDMARK_COUNT = 5;
const AXIS_DOMINANCE_MIN_RATIO = 1.3;

/**
 * Estimate the orientation of a single face from its 5-point landmarks.
 * Returns `null` when the landmarks are ambiguous or malformed.
 */
export function estimateOrientationFromSingleFace(
  landmarks: Landmark5,
  detectionScore: number,
): FaceLandmarkOrientationVote | null {
  if (!Array.isArray(landmarks) || landmarks.length < MIN_FACE_LANDMARK_COUNT) {
    return null;
  }

  const leftEye = landmarks[0];
  const rightEye = landmarks[1];
  const nose = landmarks[2];

  if (!isValidPoint(leftEye) || !isValidPoint(rightEye) || !isValidPoint(nose)) {
    return null;
  }

  const eyeMidX = (leftEye[0] + rightEye[0]) / 2;
  const eyeMidY = (leftEye[1] + rightEye[1]) / 2;

  const deltaX = nose[0] - eyeMidX;
  const deltaY = nose[1] - eyeMidY;

  const absDeltaX = Math.abs(deltaX);
  const absDeltaY = Math.abs(deltaY);

  if (absDeltaX < 1e-6 && absDeltaY < 1e-6) {
    return null;
  }

  const maxDelta = Math.max(absDeltaX, absDeltaY);
  const minDelta = Math.max(Math.min(absDeltaX, absDeltaY), 1e-6);
  const axisDominanceRatio = maxDelta / minDelta;

  if (axisDominanceRatio < AXIS_DOMINANCE_MIN_RATIO) {
    return null;
  }

  let orientation: FaceLandmarkOrientation;
  let correctionAngleClockwise: QuarterTurnAngle | 0;

  if (absDeltaY >= absDeltaX) {
    if (deltaY > 0) {
      orientation = "upright";
      correctionAngleClockwise = 0;
    } else {
      orientation = "rotated_180";
      correctionAngleClockwise = 180;
    }
  } else {
    // deltaX > 0: nose is to the RIGHT of eye midpoint → head pointing LEFT
    // → face is rotated 270° CW from upright → need 90° CW to correct
    // deltaX < 0: nose is to the LEFT of eye midpoint → head pointing RIGHT
    // → face is rotated 90° CW from upright → need 270° CW to correct
    if (deltaX > 0) {
      orientation = "rotated_270_cw";
      correctionAngleClockwise = 90;
    } else {
      orientation = "rotated_90_cw";
      correctionAngleClockwise = 270;
    }
  }

  const geometryConfidence = Math.min(1, axisDominanceRatio / 5);
  const confidence = geometryConfidence * Math.min(1, detectionScore);

  return { orientation, correctionAngleClockwise, confidence };
}

/**
 * Aggregate orientation votes from multiple faces.
 * Returns `null` when no valid votes exist.
 */
export function estimateRotationFromFaceLandmarks(
  faces: Array<{ landmarks: Landmark5; score: number }>,
): FaceLandmarkRotationResult | null {
  const votes: FaceLandmarkOrientationVote[] = [];

  for (const face of faces) {
    const vote = estimateOrientationFromSingleFace(face.landmarks, face.score);
    if (vote) {
      votes.push(vote);
    }
  }

  if (votes.length === 0) {
    return null;
  }

  const orientationScores = new Map<FaceLandmarkOrientation, number>();
  for (const vote of votes) {
    orientationScores.set(
      vote.orientation,
      (orientationScores.get(vote.orientation) ?? 0) + vote.confidence,
    );
  }

  let bestOrientation: FaceLandmarkOrientation = "upright";
  let bestScore = -1;
  for (const [orientation, score] of orientationScores) {
    if (score > bestScore) {
      bestScore = score;
      bestOrientation = orientation;
    }
  }

  const matchingVotes = votes.filter((v) => v.orientation === bestOrientation);
  const unanimousAgreement = matchingVotes.length === votes.length && votes.length > 0;

  const avgConfidence =
    matchingVotes.reduce((sum, v) => sum + v.confidence, 0) / matchingVotes.length;

  const multiFaceBoost = unanimousAgreement && votes.length > 1 ? 0.1 : 0;
  const confidence = Math.min(1, avgConfidence + multiFaceBoost);

  const correctionAngleClockwise = orientationToCorrectionAngle(bestOrientation);

  return {
    orientation: bestOrientation,
    correctionAngleClockwise,
    confidence,
    faceCount: votes.length,
    unanimousAgreement,
  };
}

/**
 * Given a VLM-suggested rotation angle and face landmark data from the
 * rotated image, determine whether the rotation should be accepted as-is,
 * flipped by 180 degrees, or rejected.
 */
export function validateRotationWithFaceLandmarks(
  vlmAngleClockwise: QuarterTurnAngle,
  faceLandmarkResult: FaceLandmarkRotationResult,
): { finalAngle: QuarterTurnAngle | 0; source: "vlm" | "face-corrected" } {
  if (faceLandmarkResult.orientation === "upright") {
    return { finalAngle: vlmAngleClockwise, source: "vlm" };
  }

  if (faceLandmarkResult.orientation === "rotated_180") {
    const flippedAngle = ((vlmAngleClockwise + 180) % 360) as 0 | QuarterTurnAngle;
    return { finalAngle: flippedAngle, source: "face-corrected" };
  }

  return { finalAngle: vlmAngleClockwise, source: "vlm" };
}

function orientationToCorrectionAngle(orientation: FaceLandmarkOrientation): QuarterTurnAngle | 0 {
  switch (orientation) {
    case "upright":
      return 0;
    case "rotated_90_cw":
      return 270;
    case "rotated_180":
      return 180;
    case "rotated_270_cw":
      return 90;
  }
}

function isValidPoint(point: unknown): point is [number, number] {
  return (
    Array.isArray(point) &&
    point.length >= 2 &&
    typeof point[0] === "number" &&
    typeof point[1] === "number" &&
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1])
  );
}

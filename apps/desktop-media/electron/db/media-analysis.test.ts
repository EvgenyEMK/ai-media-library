import { describe, expect, it } from "vitest";
import { mergeRotationEditSuggestion } from "./media-analysis";
import type { FaceOrientationMetadata } from "@emk/media-metadata-core";

describe("mergeRotationEditSuggestion", () => {
  it("returns null when there is nothing to add and no existing entries", () => {
    expect(mergeRotationEditSuggestion(null, null, "face_landmarks")).toBe(null);
  });

  it("returns null when orientation correction is 0 and no existing entries", () => {
    const upright: FaceOrientationMetadata = {
      orientation: "upright",
      correction_angle_clockwise: 0,
      confidence: 0.9,
      face_count: 3,
    };
    expect(mergeRotationEditSuggestion(null, upright, "face_landmarks")).toBe(null);
  });

  it("adds a rotation suggestion when correction angle is non-zero", () => {
    const rotation: FaceOrientationMetadata = {
      orientation: "rotated_90_cw",
      correction_angle_clockwise: 90,
      confidence: 0.8,
      face_count: 2,
    };
    const result = mergeRotationEditSuggestion(null, rotation, "face_landmarks");
    expect(result).toHaveLength(1);
    const entry = (result as Record<string, unknown>[])[0];
    expect(entry.edit_type).toBe("rotate");
    expect(entry.source).toBe("face_landmarks");
    expect((entry.rotation as Record<string, unknown>).angle_degrees_clockwise).toBe(90);
  });

  it("replaces a previous face-detection rotation entry without touching other edits", () => {
    const existing = [
      { edit_type: "rotate", source: "face_landmarks", rotation: { angle_degrees_clockwise: 90 } },
      { edit_type: "crop", source: "photo-analysis", reason: "zoom" },
    ];
    const rotation: FaceOrientationMetadata = {
      orientation: "rotated_180",
      correction_angle_clockwise: 180,
      confidence: 0.7,
      face_count: 1,
    };
    const result = mergeRotationEditSuggestion(existing, rotation, "face_landmarks");
    expect(result).toHaveLength(2);
    const types = (result as Record<string, unknown>[]).map((e) => e.edit_type);
    expect(types).toContain("crop");
    const rotEntry = (result as Record<string, unknown>[]).find(
      (e) => e.edit_type === "rotate",
    );
    expect(rotEntry?.source).toBe("face_landmarks");
    expect((rotEntry?.rotation as Record<string, unknown>).angle_degrees_clockwise).toBe(180);
  });

  it("keeps other rotation sources (e.g. photo-analysis) intact", () => {
    const existing = [
      {
        edit_type: "rotate",
        source: "photo-analysis",
        rotation: { angle_degrees_clockwise: 270 },
      },
    ];
    const rotation: FaceOrientationMetadata = {
      orientation: "rotated_90_cw",
      correction_angle_clockwise: 90,
      confidence: 0.5,
      face_count: 1,
    };
    const result = mergeRotationEditSuggestion(existing, rotation, "face_landmarks");
    expect(result).toHaveLength(2);
    const bySource = new Map(
      (result as Record<string, unknown>[]).map((e) => [e.source, e]),
    );
    expect(bySource.has("photo-analysis")).toBe(true);
    expect(bySource.has("face_landmarks")).toBe(true);
  });

  it("removes a previous face-detection rotation when no correction is needed", () => {
    const existing = [
      { edit_type: "rotate", source: "face_landmarks", rotation: { angle_degrees_clockwise: 90 } },
      { edit_type: "rotate", source: "photo-analysis", rotation: { angle_degrees_clockwise: 90 } },
    ];
    const upright: FaceOrientationMetadata = {
      orientation: "upright",
      correction_angle_clockwise: 0,
      confidence: 0.95,
      face_count: 4,
    };
    const result = mergeRotationEditSuggestion(existing, upright, "face_landmarks");
    expect(result).toHaveLength(1);
    expect(((result as Record<string, unknown>[])[0]).source).toBe("photo-analysis");
  });
});

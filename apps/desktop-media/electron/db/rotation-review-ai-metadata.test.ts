import { describe, expect, it } from "vitest";
import { buildAppliedRotationMetadata } from "./rotation-review-ai-metadata";

function parseBuiltMetadata(raw: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected metadata object.");
  }
  return parsed as Record<string, unknown>;
}

describe("buildAppliedRotationMetadata", () => {
  it("updates nested face detection size and boxes when a rotation is saved", () => {
    const metadata = parseBuiltMetadata(
      buildAppliedRotationMetadata(
        JSON.stringify({
          orientation_detection: {
            correction_angle_clockwise: 90,
            processed_at: "2026-01-01T00:00:00.000Z",
          },
          people: {
            detections: {
              image_size_for_bounding_boxes: { width: 400, height: 300 },
              people_bounding_boxes: [
                {
                  person_face_bounding_box: {
                    x: 40,
                    y: 60,
                    width: 80,
                    height: 50,
                    image_width: 400,
                    image_height: 300,
                  },
                },
              ],
            },
          },
        }),
        90,
        { width: 400, height: 300 },
      ),
    );

    expect(metadata.orientation_detection).toEqual(
      expect.objectContaining({
        correction_angle_clockwise: 0,
        user_applied_rotation: expect.objectContaining({
          angle_degrees_clockwise: 90,
          matched_processed_at: "2026-01-01T00:00:00.000Z",
          matched_correction_angle_clockwise: 90,
        }),
      }),
    );
    expect(metadata.people).toEqual({
      detections: {
        image_size_for_bounding_boxes: { width: 300, height: 400 },
        people_bounding_boxes: [
          {
            person_face_bounding_box: {
              x: 190,
              y: 40,
              width: 50,
              height: 80,
              image_width: 300,
              image_height: 400,
            },
          },
        ],
      },
    });
  });

  it("updates legacy face detection size and boxes", () => {
    const metadata = parseBuiltMetadata(
      buildAppliedRotationMetadata(
        JSON.stringify({
          image_size_for_bounding_boxes: { width: 400, height: 300 },
          people_bounding_boxes: [
            {
              person_face_bounding_box: {
                x: 40,
                y: 60,
                width: 80,
                height: 50,
                image_width: 400,
                image_height: 300,
              },
            },
          ],
        }),
        180,
        { width: 400, height: 300 },
      ),
    );

    expect(metadata.image_size_for_bounding_boxes).toEqual({ width: 400, height: 300 });
    expect(metadata.people_bounding_boxes).toEqual([
      {
        person_face_bounding_box: {
          x: 280,
          y: 190,
          width: 80,
          height: 50,
          image_width: 400,
          image_height: 300,
        },
      },
    ]);
  });
});

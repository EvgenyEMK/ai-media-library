import { describe, it, expect } from "vitest";
import {
  faceInstanceNeedsEmbedding,
  planFaceEmbeddingTargets,
  type FaceInstanceBBox,
} from "./face-embedding-target";

function inst(
  id: string,
  box: { x: number; y: number; w: number; h: number },
  embedding_status: string | null,
): FaceInstanceBBox {
  return {
    id,
    bbox_x: box.x,
    bbox_y: box.y,
    bbox_width: box.w,
    bbox_height: box.h,
    embedding_status,
  };
}

describe("faceInstanceNeedsEmbedding", () => {
  it("skips ready embeddings", () => {
    expect(faceInstanceNeedsEmbedding("ready")).toBe(false);
  });

  it("embeds pending, failed, and unknown statuses", () => {
    expect(faceInstanceNeedsEmbedding("pending")).toBe(true);
    expect(faceInstanceNeedsEmbedding("failed")).toBe(true);
    expect(faceInstanceNeedsEmbedding(null)).toBe(true);
  });
});

describe("planFaceEmbeddingTargets", () => {
  it("returns empty when every instance is ready", () => {
    const targets = planFaceEmbeddingTargets([
      inst("a", { x: 0, y: 0, w: 10, h: 10 }, "ready"),
    ]);
    expect(targets).toEqual([]);
  });

  it("aligns pending instances to detection faces by IoU", () => {
    const instances = [
      inst("old", { x: 0, y: 0, w: 50, h: 50 }, "ready"),
      inst("new", { x: 100, y: 100, w: 40, h: 40 }, "pending"),
    ];
    const detectionFaces = [
      {
        bbox_xyxy: [98, 98, 142, 142] as [number, number, number, number],
        score: 0.9,
        landmarks_5: [],
      },
    ];
    const targets = planFaceEmbeddingTargets(instances, detectionFaces);
    expect(targets).toHaveLength(1);
    expect(targets[0]?.instance.id).toBe("new");
    expect(targets[0]?.detectionFaceIndex).toBe(0);
  });
});

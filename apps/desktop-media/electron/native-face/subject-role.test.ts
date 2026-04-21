import { describe, expect, it } from "vitest";
import { classifyFaceSubjectRoles } from "./subject-role";
import type { FaceDetectionBox } from "../../src/shared/ipc";

function face(x1: number, y1: number, x2: number, y2: number): FaceDetectionBox {
  return { bbox_xyxy: [x1, y1, x2, y2], score: 0.99, landmarks_5: [] };
}

describe("classifyFaceSubjectRoles", () => {
  it("returns empty for empty input", () => {
    expect(classifyFaceSubjectRoles([], { width: 100, height: 100 }, {
      minSizeRatioToLargest: 0.5,
      minImageAreaRatio: 0.01,
    })).toEqual([]);
  });

  it("single face is main when area passes the floor", () => {
    const result = classifyFaceSubjectRoles(
      [face(0, 0, 50, 50)],
      { width: 100, height: 100 },
      { minSizeRatioToLargest: 0.5, minImageAreaRatio: 0.01 },
    );
    expect(result[0].subjectRole).toBe("main");
    expect(result[0].bboxShortSideRatioToLargest).toBe(1);
  });

  it("tiny single face is background when area floor is not met", () => {
    const result = classifyFaceSubjectRoles(
      [face(0, 0, 5, 5)],
      { width: 1000, height: 1000 },
      { minSizeRatioToLargest: 0.5, minImageAreaRatio: 0.01 },
    );
    expect(result[0].subjectRole).toBe("background");
  });

  it("distinguishes main (selfie) vs background (crowd) faces", () => {
    const faces = [
      face(0, 0, 200, 200),
      face(300, 0, 500, 200),
      face(600, 600, 650, 650),
      face(700, 700, 740, 740),
      face(800, 800, 830, 830),
    ];
    const result = classifyFaceSubjectRoles(
      faces,
      { width: 1000, height: 1000 },
      { minSizeRatioToLargest: 0.5, minImageAreaRatio: 0.01 },
    );
    expect(result[0].subjectRole).toBe("main");
    expect(result[1].subjectRole).toBe("main");
    expect(result[2].subjectRole).toBe("background");
    expect(result[3].subjectRole).toBe("background");
    expect(result[4].subjectRole).toBe("background");
  });

  it("threshold=1 means only the single largest face is main", () => {
    const faces = [face(0, 0, 200, 200), face(300, 0, 450, 150)];
    const result = classifyFaceSubjectRoles(
      faces,
      { width: 1000, height: 1000 },
      { minSizeRatioToLargest: 1, minImageAreaRatio: 0 },
    );
    expect(result[0].subjectRole).toBe("main");
    expect(result[1].subjectRole).toBe("background");
  });
});

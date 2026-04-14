import { describe, expect, it } from "vitest";
import {
  FACE_BBOX_REF_HEIGHT_SQL,
  FACE_BBOX_REF_WIDTH_SQL,
} from "./face-instance-display-dimensions";

describe("face bbox reference dimensions (People thumbnails / hover)", () => {
  it("SQL width expression prefers bbox_ref then media_items", () => {
    expect(FACE_BBOX_REF_WIDTH_SQL).toBe("COALESCE(fi.bbox_ref_width, mi.width)");
  });

  it("SQL height expression prefers bbox_ref then media_items", () => {
    expect(FACE_BBOX_REF_HEIGHT_SQL).toBe("COALESCE(fi.bbox_ref_height, mi.height)");
  });

  it("wrong media dimensions skew normalized bbox center; detection dimensions fix it", () => {
    const bbox = { x: 1412, y: 1916, w: 200, h: 200 };
    const refW = 3024;
    const refH = 4032;
    const cxCorrect = (bbox.x + bbox.w / 2) / refW;
    const cyCorrect = (bbox.y + bbox.h / 2) / refH;
    expect(Math.abs(cxCorrect - 0.5)).toBeLessThan(0.02);
    expect(Math.abs(cyCorrect - 0.5)).toBeLessThan(0.02);

    const wrongW = 4032;
    const wrongH = 3024;
    const cxWrong = (bbox.x + bbox.w / 2) / wrongW;
    expect(Math.abs(cxWrong - 0.5)).toBeGreaterThan(0.08);
  });
});

/** Paths reported where thumbnail coordinate space did not match RetinaFace detection space. */
export const FACE_BBOX_REGRESSION_PATHS = [
  String.raw`C:\EMK-Media\2024 Mobile phone\Camera\20230531_133344.jpg`,
  String.raw`C:\EMK-Media\2024 Mobile phone\Camera\20220923_122845.jpg`,
  String.raw`C:\EMK-Media\2024 Mobile phone\Camera\20210722_222741.jpg`,
  String.raw`C:\EMK-Media\2024 Mobile phone\Camera\20210723_203047.jpg`,
] as const;

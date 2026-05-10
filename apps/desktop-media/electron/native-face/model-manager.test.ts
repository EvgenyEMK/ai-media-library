import { describe, expect, it } from "vitest";

import { listAllManagedOnnxFilenames } from "./model-manager";

describe("model-manager", () => {
  it("listAllManagedOnnxFilenames includes core, detector, and aux ONNX basenames", () => {
    const names = listAllManagedOnnxFilenames();
    expect(names).toContain("w600k_r50.onnx");
    expect(names).toContain("retinaface_mv2.onnx");
    expect(names).toContain("yolov12n-face.onnx");
    expect(names).toContain("deep-image-orientation.onnx");
    expect(names).toContain("pfld_ghostone.onnx");
    expect(names).toContain("age-gender.onnx");
  });

  it("listAllManagedOnnxFilenames has no duplicate entries", () => {
    const names = listAllManagedOnnxFilenames();
    expect(new Set(names).size).toBe(names.length);
  });
});

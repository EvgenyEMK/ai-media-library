import { describe, expect, it } from "vitest";
import { getFaceModelDownloadCardTitle } from "./face-model-download-title";

describe("getFaceModelDownloadCardTitle", () => {
  it("prefers filename mapping over message", () => {
    expect(
      getFaceModelDownloadCardTitle({
        filename: "w600k_r50.onnx",
        message: "Downloading face detector model (yolov12m-face)...",
      }),
    ).toBe("AI model download - Face recognition");
  });

  it.each([
    ["retinaface_mv2.onnx", "AI model download - Face detection"],
    ["yolov12n-face.onnx", "AI model download - Face detection"],
    ["yolov12m-face.onnx", "AI model download - Face detection"],
    ["deep-image-orientation.onnx", "AI model download - Image orientation"],
    ["pfld_ghostone.onnx", "AI model download - Face shape details"],
    ["age-gender.onnx", "AI model download - Age and gender (faces)"],
  ] as const)("maps %s", (filename, expected) => {
    expect(getFaceModelDownloadCardTitle({ filename, message: "" })).toBe(expected);
  });

  it.each([
    [
      "Downloading AI face detection and recognition models...",
      "AI model download - Face detection and recognition",
    ],
    [
      "Failed to download AI face detection and recognition models.",
      "AI model download - Face detection and recognition",
    ],
    ["Downloading face detector model (yolov12m-face)...", "AI model download - Face detection"],
    ["Failed to download face detector model (yolov12m-face).", "AI model download - Face detection"],
    [
      "Failed to download orientation model (deep-image-orientation-v1).",
      "AI model download - Image orientation",
    ],
    ["Failed to download landmarks model (pfld-ghostone).", "AI model download - Face shape details"],
    [
      "Failed to download age-gender model (onnx-age-gender-v1).",
      "AI model download - Age and gender (faces)",
    ],
  ] as const)("maps message when filename is absent: %s", (message, expected) => {
    expect(getFaceModelDownloadCardTitle({ filename: null, message })).toBe(expected);
  });

  it("falls back when nothing matches", () => {
    expect(
      getFaceModelDownloadCardTitle({ filename: null, message: "Custom unknown download." }),
    ).toBe("AI model download - AI models");
  });
});

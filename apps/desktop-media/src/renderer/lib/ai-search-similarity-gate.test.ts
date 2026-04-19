import { describe, it, expect } from "vitest";
import { passesAiImageSearchSimilarityGate } from "./ai-search-similarity-gate";

describe("passesAiImageSearchSimilarityGate", () => {
  const tV = 0.04;
  const tD = 0.6;

  it("passes when VLM is at threshold", () => {
    expect(passesAiImageSearchSimilarityGate({ vlmSimilarity: 0.04, descriptionSimilarity: 0 }, tV, tD)).toBe(
      true,
    );
  });

  it("hybrid-max uses same OR gate as hybrid", () => {
    expect(
      passesAiImageSearchSimilarityGate(
        { vlmSimilarity: 0.04, descriptionSimilarity: 0 },
        tV,
        tD,
        "hybrid-max",
      ),
    ).toBe(true);
  });

  it("passes when description is at threshold", () => {
    expect(
      passesAiImageSearchSimilarityGate({ vlmSimilarity: 0.01, descriptionSimilarity: 0.6 }, tV, tD),
    ).toBe(true);
  });

  it("fails when both are strictly below thresholds", () => {
    expect(
      passesAiImageSearchSimilarityGate({ vlmSimilarity: 0.039, descriptionSimilarity: 0.599 }, tV, tD),
    ).toBe(false);
  });

  it("passes when VLM ok and description missing", () => {
    expect(passesAiImageSearchSimilarityGate({ vlmSimilarity: 0.1 }, tV, tD)).toBe(true);
  });

  it("fails when description missing and VLM below threshold", () => {
    expect(passesAiImageSearchSimilarityGate({ vlmSimilarity: 0.02 }, tV, tD)).toBe(false);
  });

  it("passes when VLM missing and description ok", () => {
    expect(passesAiImageSearchSimilarityGate({ descriptionSimilarity: 0.7 }, tV, tD)).toBe(true);
  });

  it("fails when both signals missing", () => {
    expect(passesAiImageSearchSimilarityGate({}, tV, tD)).toBe(false);
  });

  it("vlm-only ignores strong description when VLM is weak", () => {
    expect(
      passesAiImageSearchSimilarityGate(
        { vlmSimilarity: 0.01, descriptionSimilarity: 0.9 },
        tV,
        tD,
        "vlm-only",
      ),
    ).toBe(false);
  });

  it("vlm-only passes on VLM alone", () => {
    expect(
      passesAiImageSearchSimilarityGate(
        { vlmSimilarity: 0.04, descriptionSimilarity: 0.01 },
        tV,
        tD,
        "vlm-only",
      ),
    ).toBe(true);
  });

  it("description-only ignores strong VLM when description is weak", () => {
    expect(
      passesAiImageSearchSimilarityGate(
        { vlmSimilarity: 0.9, descriptionSimilarity: 0.01 },
        tV,
        tD,
        "description-only",
      ),
    ).toBe(false);
  });

  it("description-only passes on description alone", () => {
    expect(
      passesAiImageSearchSimilarityGate(
        { vlmSimilarity: 0.01, descriptionSimilarity: 0.6 },
        tV,
        tD,
        "description-only",
      ),
    ).toBe(true);
  });
});

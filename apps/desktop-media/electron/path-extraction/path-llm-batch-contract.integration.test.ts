import { describe, expect, it } from "vitest";
import {
  PATH_LLM_BATCH_FIXTURE_15,
  runPathLlmFixtureProductionPipeline,
} from "./path-llm-batch-contract";
import { LLM_PATH_ANALYSIS_BATCH_SIZE } from "./llm-path-analyzer";

const RUN_LIVE = process.env.EMK_OLLAMA_PATH_BATCH_TEST === "1";

describe.runIf(RUN_LIVE)("path LLM fixture — production pipeline (live Ollama)", () => {
  it("fixture size matches batch constant", () => {
    expect(PATH_LLM_BATCH_FIXTURE_15.length).toBe(LLM_PATH_ANALYSIS_BATCH_SIZE);
  });

  it(
    "analyzePathsWithLlm returns 15 results with at least 8 rows containing date or display_title",
    async () => {
      const { model, results } = await runPathLlmFixtureProductionPipeline({ quiet: true });
      expect(model.length).toBeGreaterThan(0);
      expect(results).toHaveLength(PATH_LLM_BATCH_FIXTURE_15.length);
      const extracted = results.filter((r) => r.date != null || r.display_title != null).length;
      expect(extracted).toBeGreaterThanOrEqual(8);
    },
    900_000,
  );
});

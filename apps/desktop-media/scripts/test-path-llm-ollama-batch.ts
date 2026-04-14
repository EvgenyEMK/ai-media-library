#!/usr/bin/env npx tsx
/**
 * Live integration: runs the **same** path-metadata LLM pipeline as Electron (`analyzePathsWithLlm`),
 * including per-file fallback when the model returns one JSON object for a 15-file batch.
 *
 * From apps/desktop-media:
 *   pnpm run test:path-llm-ollama-batch
 *   pnpm exec tsx scripts/test-path-llm-ollama-batch.ts --verbose   # quiet=false (full debug logs)
 *   pnpm exec tsx scripts/test-path-llm-ollama-batch.ts --strict  # same as pnpm run test:path-llm-ollama-bulk (single POST, JSON array of 15)
 *
 * Env: EMK_OLLAMA_BASE_URL, OLLAMA_MODEL
 */
import {
  PATH_LLM_BATCH_FIXTURE_15,
  runPathLlmBatchContract,
  runPathLlmFixtureProductionPipeline,
} from "../electron/path-extraction/path-llm-batch-contract";
import { LLM_PATH_ANALYSIS_BATCH_SIZE } from "../electron/path-extraction/llm-path-analyzer";

function parseFlags(argv: string[]): { verbose: boolean; strict: boolean; model: string | null } {
  let verbose = false;
  let strict = false;
  let model: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--verbose" || a === "-v") {
      verbose = true;
      continue;
    }
    if (a === "--strict") {
      strict = true;
      continue;
    }
    if (a === "--model" && argv[i + 1]) {
      model = argv[++i].trim();
      continue;
    }
    if (a.startsWith("--model=")) {
      model = a.slice("--model=".length).trim();
    }
  }
  return { verbose, strict, model: model || null };
}

function countWithExtractedFields(results: Array<{ date: unknown; display_title: unknown }>): number {
  return results.filter((r) => r.date != null || r.display_title != null).length;
}

async function main(): Promise<void> {
  const { verbose, strict, model } = parseFlags(process.argv.slice(2));
  const preferred = model ?? process.env.OLLAMA_MODEL?.trim() ?? null;

  console.log(
    `[path-llm-batch-cli] fixture paths=${PATH_LLM_BATCH_FIXTURE_15.length} (batch size ${LLM_PATH_ANALYSIS_BATCH_SIZE})`,
  );

  if (strict) {
    const r = await runPathLlmBatchContract({
      paths: PATH_LLM_BATCH_FIXTURE_15,
      preferredModel: preferred,
      verbose,
    });
    console.log(
      `[path-llm-batch-cli][strict] http=${r.httpStatus} contractOk=${r.contractOk} unwrappedLen=${r.unwrappedLength}`,
    );
    if (r.httpStatus !== 200 || !r.parsedOk || !r.contractOk) {
      console.log("[path-llm-batch-cli][strict] FAIL — model must return a JSON array of 15 objects in one response.");
      process.exit(2);
    }
    console.log("[path-llm-batch-cli][strict] PASS");
    return;
  }

  try {
    const { model: usedModel, results } = await runPathLlmFixtureProductionPipeline({
      preferredModel: preferred,
      quiet: !verbose,
    });

    if (results.length !== PATH_LLM_BATCH_FIXTURE_15.length) {
      console.log(
        `[path-llm-batch-cli] FAIL: expected ${PATH_LLM_BATCH_FIXTURE_15.length} results, got ${results.length}`,
      );
      process.exit(1);
    }

    const extracted = countWithExtractedFields(results);
    console.log(
      `[path-llm-batch-cli] model=${usedModel} results=${results.length} with date or title=${extracted}`,
    );

    if (extracted < 8) {
      console.log("[path-llm-batch-cli] FAIL: too few rows with date or display_title (need >= 8 for fixture).");
      process.exit(1);
    }

    console.log("[path-llm-batch-cli] PASS — production pipeline returned 15 rows with usable metadata.");
  } catch (e) {
    console.log("[path-llm-batch-cli] FAIL:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

void main().catch((e) => {
  console.log(e);
  process.exit(1);
});

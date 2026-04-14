#!/usr/bin/env npx tsx
/**
 * Strict bulk-only check: one POST /api/chat with N paths (same body as Electron),
 * no per-file fallback. Use to verify the model returns a JSON array of length N.
 *
 * From apps/desktop-media:
 *   pnpm run test:path-llm-ollama-bulk
 *   pnpm exec tsx scripts/test-path-llm-ollama-bulk.ts --verbose
 *   pnpm exec tsx scripts/test-path-llm-ollama-bulk.ts --model qwen2.5vl:3b
 *
 * Env: EMK_OLLAMA_BASE_URL, OLLAMA_MODEL
 */
import {
  PATH_LLM_BATCH_FIXTURE_15,
  PATH_LLM_MIXED_FOLDER_FILE_FIXTURE_15,
  runPathLlmBatchContract,
} from "../electron/path-extraction/path-llm-batch-contract";
import { LLM_PATH_ANALYSIS_BATCH_SIZE } from "../electron/path-extraction/llm-path-analyzer";

function parseFlags(argv: string[]): { verbose: boolean; model: string | null } {
  let verbose = false;
  let model: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--verbose" || a === "-v") {
      verbose = true;
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
  return { verbose, model: model || null };
}

async function main(): Promise<void> {
  const { verbose, model } = parseFlags(process.argv.slice(2));
  const preferred = model ?? process.env.OLLAMA_MODEL?.trim() ?? null;

  const checks: Array<{ name: string; paths: readonly string[] }> = [
    { name: "files-15", paths: PATH_LLM_BATCH_FIXTURE_15 },
    { name: "mixed-folder-file-15", paths: PATH_LLM_MIXED_FOLDER_FILE_FIXTURE_15 },
  ];
  for (const check of checks) {
    console.log(
      `[path-llm-bulk-cli] ${check.name}: paths=${check.paths.length} (batch size ${LLM_PATH_ANALYSIS_BATCH_SIZE})`,
    );
    const r = await runPathLlmBatchContract({
      paths: check.paths,
      preferredModel: preferred,
      verbose,
    });
    console.log(
      `[path-llm-bulk-cli] ${check.name}: http=${r.httpStatus} contractOk=${r.contractOk} parsedOk=${r.parsedOk} unwrappedLen=${r.unwrappedLength ?? "null"}`,
    );
    if (r.httpStatus !== 200 || !r.parsedOk || !r.contractOk) {
      if (r.parseError) {
        console.log("[path-llm-bulk-cli] parseError:", r.parseError);
      }
      console.log(
        `[path-llm-bulk-cli] FAIL (${check.name}) — model must return valid JSON: a top-level array of N objects (one POST, no per-file fallback).`,
      );
      process.exit(2);
    }
  }

  console.log("[path-llm-bulk-cli] PASS");
}

void main().catch((e) => {
  console.log(e);
  process.exit(1);
});

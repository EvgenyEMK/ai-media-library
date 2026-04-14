/**
 * Shared fixture + Ollama round-trip check for path-metadata **multi-file** batches.
 * Used by `scripts/test-path-llm-ollama-batch.ts` and opt-in Vitest integration.
 */

import { getOllamaBaseUrlForModelResolve, resolveOllamaTextChatModel } from "../ollama-model-resolve";
import {
  analyzePathsWithLlm,
  buildPathLlmOllamaChatBody,
  LLM_PATH_ANALYSIS_BATCH_SIZE,
  type LlmPathResult,
  unwrapPathLlmChatJsonToArray,
} from "./llm-path-analyzer";
import { isPathExtractionDebugEnabled } from "./path-extraction-debug";

/** Same 15 paths as real folder logs — must stay aligned with `LLM_PATH_ANALYSIS_BATCH_SIZE`. */
const FIXTURE_FOLDER =
  "C:\\EMK-Media\\Photo 2000--2005\\2002\\2002-05-09 Anncy-France , Billard in Geneva";

export const PATH_LLM_BATCH_FIXTURE_15: readonly string[] = [
  `${FIXTURE_FOLDER}\\2005-05-09_.jpg`,
  `${FIXTURE_FOLDER}\\2005-05-09_emk.jpg`,
  `${FIXTURE_FOLDER}\\Image03_emk.jpg`,
  `${FIXTURE_FOLDER}\\Image04.jpg`,
  `${FIXTURE_FOLDER}\\Image04a.jpg`,
  `${FIXTURE_FOLDER}\\Image05.jpg`,
  `${FIXTURE_FOLDER}\\Image06_emk.jpg`,
  `${FIXTURE_FOLDER}\\Image07_EMK.jpg`,
  `${FIXTURE_FOLDER}\\Image08.jpg`,
  `${FIXTURE_FOLDER}\\Image09_emk.jpg`,
  `${FIXTURE_FOLDER}\\Image10.jpg`,
  `${FIXTURE_FOLDER}\\Image11.jpg`,
  `${FIXTURE_FOLDER}\\Image12.jpg`,
  `${FIXTURE_FOLDER}\\Image14_EMK.jpg`,
  `${FIXTURE_FOLDER}\\Image15_EMK.jpg`,
] as const;

/**
 * Mixed fixture: folders + camera-prefix files.
 * Used to validate folder/file bundle prompts as used by folder-first path analysis.
 */
export const PATH_LLM_MIXED_FOLDER_FILE_FIXTURE_15: readonly string[] = [
  "C:\\EMK-Media\\Photo 2000--2005\\2002\\2002-05-09 Annecy-France, Billard in Geneva",
  `${FIXTURE_FOLDER}\\Image03_emk.jpg`,
  `${FIXTURE_FOLDER}\\Image04.jpg`,
  "C:\\EMK-Media\\Photo 2000--2005\\2002\\2002-05-10 Geneva Old Town Walk",
  "C:\\EMK-Media\\Photo 2000--2005\\2002\\2002-05-10 Geneva Old Town Walk\\DSC_2240.jpg",
  "C:\\EMK-Media\\Photo 2000--2005\\2002\\2002-05-10 Geneva Old Town Walk\\DSC_2242.jpg",
  "C:\\EMK-Media\\Photo 2000--2005\\2002\\2002-06-15 Vacations - Geneva-Annecy-Nice",
  "C:\\EMK-Media\\Photo 2000--2005\\2002\\2002-06-15 Vacations - Geneva-Annecy-Nice\\IMG_0001.jpg",
  "C:\\EMK-Media\\Photo 2000--2005\\2002\\2002-06-15 Vacations - Geneva-Annecy-Nice\\scan0006.jpg",
  "C:\\EMK-Media\\Photo 2000--2005\\2002\\2002-06-15 Vacations - Geneva-Annecy-Nice\\2002-06-15 beach near Nice.jpg",
  "C:\\EMK-Media\\Photo 2000--2005\\2002\\2002-07 Family Visit Lausanne",
  "C:\\EMK-Media\\Photo 2000--2005\\2002\\2002-07 Family Visit Lausanne\\P0001234.JPG",
  "C:\\EMK-Media\\Photo 2000--2005\\2002\\2002-07 Family Visit Lausanne\\Image15_EMK.jpg",
  "C:\\EMK-Media\\Photo 2000--2005\\2002\\2002-08 hiking near Annecy\\IMG_20200306_185130.jpg",
  "C:\\EMK-Media\\Photo 2000--2005\\2002\\2002-08 hiking near Annecy\\2002-08 trail head.jpg",
] as const;

if (PATH_LLM_BATCH_FIXTURE_15.length !== LLM_PATH_ANALYSIS_BATCH_SIZE) {
  throw new Error(
    `PATH_LLM_BATCH_FIXTURE_15 length ${PATH_LLM_BATCH_FIXTURE_15.length} !== LLM_PATH_ANALYSIS_BATCH_SIZE ${LLM_PATH_ANALYSIS_BATCH_SIZE}`,
  );
}

const DEFAULT_BATCH_TIMEOUT_MS = 120_000;

function stripJsonFences(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence?.[1]) return fence[1].trim();
  return t;
}

export type PathLlmBatchContractResult = {
  baseUrl: string;
  httpStatus: number;
  model: string;
  pathCount: number;
  rawContent: string;
  parsedOk: boolean;
  parseError?: string;
  unwrappedLength: number | null;
  /** True when unwrap yields an array of length pathCount (production batch contract). */
  contractOk: boolean;
};

/**
 * Single POST /api/chat — same JSON body shape as `fetchPathLlmOnce` (no per-file fallback).
 */
export async function runPathLlmBatchContract(options?: {
  paths?: readonly string[];
  preferredModel?: string | null;
  timeoutMs?: number;
  verbose?: boolean;
}): Promise<PathLlmBatchContractResult> {
  const paths = options?.paths ?? PATH_LLM_BATCH_FIXTURE_15;
  const pathCount = paths.length;
  const verbose = options?.verbose === true;
  const baseUrl = getOllamaBaseUrlForModelResolve();
  const model = await resolveOllamaTextChatModel({
    preferred: options?.preferredModel?.trim() || null,
  });
  if (!model) {
    throw new Error("No Ollama text model resolved (/api/tags). Pull e.g. qwen2.5vl:3b.");
  }

  const chatUrl = `${baseUrl}/api/chat`;
  const body = buildPathLlmOllamaChatBody([...paths], 0, model);

  if (verbose || isPathExtractionDebugEnabled()) {
    const { messages } = body;
    const system = messages.find((m) => m.role === "system")?.content ?? "";
    const user = messages.find((m) => m.role === "user")?.content ?? "";
    console.log(`[path-llm-contract] paths=${pathCount} model=${model} POST ${chatUrl}`);
    console.log("[path-llm-contract] --- system ---\n", system);
    console.log("[path-llm-contract] --- user ---\n", user);
    console.log("[path-llm-contract] format:", JSON.stringify(body.format));
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_BATCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let httpStatus = 0;
  let rawContent = "";
  try {
    const response = await fetch(chatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    httpStatus = response.status;
    const json = (await response.json()) as { message?: { content?: string } };
    const content = json.message?.content;
    rawContent = typeof content === "string" ? content : content != null ? JSON.stringify(content) : "";
  } finally {
    clearTimeout(timer);
  }

  if (verbose || isPathExtractionDebugEnabled()) {
    console.log("[path-llm-contract] --- raw message.content ---\n", rawContent);
  }

  let parsed: unknown;
  let parsedOk = false;
  let parseError: string | undefined;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
    parsedOk = true;
  } catch (e) {
    parseError = e instanceof Error ? e.message : String(e);
  }

  const unwrapped = parsedOk
    ? unwrapPathLlmChatJsonToArray(parsed as unknown, pathCount, {
        logMultiFileSingleObject: false,
      })
    : null;
  const unwrappedLength = unwrapped ? unwrapped.length : null;
  const contractOk = unwrappedLength === pathCount;

  return {
    baseUrl,
    httpStatus,
    model,
    pathCount,
    rawContent,
    parsedOk,
    parseError,
    unwrappedLength,
    contractOk,
  };
}

export type PathLlmFixturePipelineResult = {
  model: string;
  results: LlmPathResult[];
};

/**
 * Same path-metadata flow as the Electron job: batched LLM + per-file fallback when the model
 * returns a single object for a multi-file batch (e.g. qwen2.5vl:3b).
 */
export async function runPathLlmFixtureProductionPipeline(options?: {
  preferredModel?: string | null;
  /** Default true: suppress batch debug logs (use false to mirror Electron main-process verbosity). */
  quiet?: boolean;
}): Promise<PathLlmFixturePipelineResult> {
  const model = await resolveOllamaTextChatModel({
    preferred: options?.preferredModel?.trim() ?? null,
  });
  if (!model) {
    throw new Error("No Ollama text model resolved (/api/tags).");
  }
  const quiet = options?.quiet !== false;
  const results = await analyzePathsWithLlm([...PATH_LLM_BATCH_FIXTURE_15], model, { quiet });
  return { model, results };
}

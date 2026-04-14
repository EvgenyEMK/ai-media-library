import type {
  PathDateExtraction,
  PathLocationExtraction,
  PathExtractionMetadata,
} from "./types";
import {
  isPathExtractionDebugEnabled,
  pathExtractionDebugLog,
} from "./path-extraction-debug";

const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_TIMEOUT_MS = 60_000;
export const LLM_PATH_ANALYSIS_BATCH_SIZE = 15;

function getOllamaBaseUrl(): string {
  const raw =
    process.env.EMK_OLLAMA_BASE_URL ?? process.env.EMK_OLLAMA_URL ?? "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_OLLAMA_BASE_URL;
}

const SYSTEM_PROMPT = `You are a metadata extraction engine for a personal photo/video library.
Given a list of full file paths, extract structured metadata from each filename and its folder hierarchy. Folders often encode event dates, locations, and people names.

Return a JSON array with one object per file, in the same order:
[
  {
    "index": 1,
    "date": {
      "start": "YYYY or YYYY-MM or YYYY-MM-DD or null",
      "end": "null or same format (for date ranges)"
    },
    "location": {
      "country": "country name or null",
      "country_code": "ISO 2-letter code or null",
      "area": "province/state/canton or null",
      "city": "city name or null if not present or if doen't match the country"
    },
    "display_title": "cleaned human readable file title based only on file name (ignore file path). Remove camera prefix or similar). Null if not possible."
  }
]

Rules:
- Use folder hierarchy context to infer dates/locations not explicit in filename.
- If a folder name contains a date range, apply it to files within.
- If file name includes location details, prioritize it over similar data in folder path.
- Return null for fields you cannot determine.
- If a path appears to mention multiple countries or multiple cities, set "country" and/or "city" to null.
- If country and city are inconsistent (example: "Germany", "Paris"), set both "country" and "city" to null.
- If extracted city does not match country, set both "country" and "city" to null.
- Keep display_title concise: strip file extensions, scan IDs, camera prefixes.
- Always return a JSON **array** with one element per input path (same order), even when there is only one file: [{...}] not {...}.
- Return ONLY the JSON array, no commentary.
- If the user lists N paths with N>1, the root JSON value MUST be an Array of length N. Returning one Object that summarizes all files is invalid.`;

/** Ollama /api/chat body; multi-file uses JSON Schema so the runtime enforces a top-level array. */
export function buildPathLlmOllamaChatBody(
  paths: string[],
  startIndex: number,
  model: string,
): {
  model: string;
  messages: Array<{ role: "system" | "user"; content: string }>;
  stream: false;
  format: "json" | Record<string, unknown>;
  options: { temperature: number };
} {
  const { system, user } = getPathLlmChatPrompts(paths, startIndex);
  const multi = paths.length > 1;
  return {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    stream: false,
    format: multi
      ? {
          type: "array",
          minItems: paths.length,
          maxItems: paths.length,
          items: { type: "object", additionalProperties: true },
        }
      : "json",
    options: { temperature: 0.1 },
  };
}

/** Same strings as production `/api/chat` — for manual Ollama CLI/script tests. */
export function getPathLlmChatPrompts(
  paths: string[],
  startIndex = 0,
): { system: string; user: string } {
  const numberedList = paths
    .map((p, i) => `${startIndex + i + 1}. ${p}`)
    .join("\n");
  const n = paths.length;
  let user = `File paths:\n${numberedList}`;
  if (n > 1) {
    user += [
      "",
      "Output requirements:",
      `- Reply with one JSON array only (no markdown fences, no commentary).`,
      `- The array must contain exactly ${n} objects, same order as the paths above (path line ${startIndex + 1} → array[0], …).`,
      `- The first non-whitespace character of your reply must be "[".`,
      `- Do not return a single JSON object for the whole batch.`,
    ].join("\n");
  }
  return {
    system: SYSTEM_PROMPT,
    user,
  };
}

/** Collect prompts/responses for one `analyzePathsWithLlm*` job (verbose mode). */
export type PathLlmDebugLogSession = {
  systemLogged: boolean;
  model: string;
  rawContents: string[];
};

/** Optional behavior for tests / CLI (Electron app uses defaults). */
export type PathLlmCallOptions = {
  /**
   * When true, skips LLM parse/batch warnings where noted. Verbose prompt/response `console.log`
   * output also requires `EMK_DEBUG_PATH_EXTRACTION=1` (or `true` / `yes`).
   */
  quiet?: boolean;
  /** Filled by `analyzePathsWithLlm` / `analyzePathsWithLlmStreaming` when not quiet; do not set manually. */
  debugLog?: PathLlmDebugLogSession;
};

function flushPathLlmDebugLog(sess: PathLlmDebugLogSession | undefined): void {
  if (!sess?.rawContents.length) return;
  const n = sess.rawContents.length;
  const body = sess.rawContents
    .map((c, i) => `[response ${i + 1}/${n}]\n${c}`)
    .join("\n\n----------\n\n");
  // Single string so Electron / some terminals do not drop the payload (second console.log arg).
  pathExtractionDebugLog(
    `[llm-path-analyzer][debug] --- consolidated raw message.content (bulk only: ${n} Ollama response(s), model=${sess.model}) ---\n${body}`,
  );
}

export interface LlmPathResult {
  index: number;
  date: {
    start: string | null;
    end: string | null;
    precision: "year" | "month" | "day";
  } | null;
  location: {
    country: string | null;
    country_code: string | null;
    area: string | null;
    city: string | null;
  } | null;
  display_title: string | null;
}

/**
 * Analyze a batch of file paths using a local LLM (Ollama text model).
 * Returns one result per input path.
 *
 * @param model Resolved Ollama model id (from {@link resolveOllamaTextChatModel} or explicit settings).
 */
export async function analyzePathsWithLlm(
  paths: string[],
  model: string,
  options?: PathLlmCallOptions,
): Promise<LlmPathResult[]> {
  const debugLog: PathLlmDebugLogSession | undefined =
    options?.quiet === true || !isPathExtractionDebugEnabled()
      ? undefined
      : {
          systemLogged: false,
          model,
          rawContents: [],
        };
  const callOpts: PathLlmCallOptions =
    debugLog != null ? { ...options, debugLog } : { ...options };

  const results: LlmPathResult[] = [];

  try {
    for (let i = 0; i < paths.length; i += LLM_PATH_ANALYSIS_BATCH_SIZE) {
      const batch = paths.slice(i, i + LLM_PATH_ANALYSIS_BATCH_SIZE);
      const batchResults = await analyzeBatch(batch, i, model, callOpts);
      results.push(...batchResults);
    }
    return results;
  } finally {
    flushPathLlmDebugLog(debugLog);
  }
}

/**
 * Runs LLM analysis in fixed-size batches, invoking `onAfterBatch` after each HTTP round-trip.
 * Return `false` from the callback to stop before the next batch.
 */
export async function analyzePathsWithLlmStreaming(
  paths: string[],
  model: string,
  onAfterBatch: (args: {
    batchPaths: string[];
    batchResults: LlmPathResult[];
    cumulativeProcessed: number;
    total: number;
  }) => boolean | Promise<boolean>,
  options?: PathLlmCallOptions,
): Promise<void> {
  const debugLog: PathLlmDebugLogSession | undefined =
    options?.quiet === true || !isPathExtractionDebugEnabled()
      ? undefined
      : {
          systemLogged: false,
          model,
          rawContents: [],
        };
  const callOpts: PathLlmCallOptions =
    debugLog != null ? { ...options, debugLog } : { ...options };

  const total = paths.length;
  let cumulative = 0;
  try {
    for (let i = 0; i < paths.length; i += LLM_PATH_ANALYSIS_BATCH_SIZE) {
      const batchPaths = paths.slice(i, i + LLM_PATH_ANALYSIS_BATCH_SIZE);
      const batchResults = await analyzeBatch(batchPaths, i, model, callOpts);
      cumulative += batchPaths.length;
      const continueNext = await onAfterBatch({
        batchPaths,
        batchResults,
        cumulativeProcessed: cumulative,
        total,
      });
      if (!continueNext) {
        return;
      }
    }
  } finally {
    flushPathLlmDebugLog(debugLog);
  }
}

function isEffectivelyEmptyLlmPathResult(r: LlmPathResult): boolean {
  return (
    r.date === null &&
    r.location === null &&
    r.display_title === null
  );
}

async function analyzeBatch(
  paths: string[],
  startIndex: number,
  model: string,
  callOpts?: PathLlmCallOptions,
): Promise<LlmPathResult[]> {
  const results = await fetchPathLlmOnce(paths, startIndex, model, callOpts);
  if (paths.length > 1 && results.every(isEffectivelyEmptyLlmPathResult)) {
    if (!callOpts?.quiet) {
      console.warn(
        `[llm-path-analyzer] multi-file batch (${paths.length} paths) produced no usable metadata; retrying one file per request (model may not support multi-file JSON arrays).`,
      );
    }
    const out: LlmPathResult[] = [];
    for (let i = 0; i < paths.length; i++) {
      out.push(...(await analyzeBatch([paths[i]!], startIndex + i, model, callOpts)));
    }
    return out;
  }
  return results;
}

async function fetchPathLlmOnce(
  paths: string[],
  startIndex: number,
  model: string,
  callOpts?: PathLlmCallOptions,
): Promise<LlmPathResult[]> {
  const { system, user } = getPathLlmChatPrompts(paths, startIndex);
  const chatUrl = `${getOllamaBaseUrl()}/api/chat`;

  if (!callOpts?.quiet && isPathExtractionDebugEnabled()) {
    const sess = callOpts?.debugLog;
    if (sess) {
      if (!sess.systemLogged) {
        pathExtractionDebugLog(`[llm-path-analyzer][debug] model=${model}`);
        pathExtractionDebugLog(
          "[llm-path-analyzer][debug] --- system prompt (once per job) ---\n",
          system,
        );
        sess.systemLogged = true;
      }
      if (paths.length > 1) {
        pathExtractionDebugLog(
          `[llm-path-analyzer][debug] --- user prompt (multi-file: ${paths.length} paths, startIndex=${startIndex}) ---\n`,
          user,
        );
      } else if (sess.rawContents.length === 0) {
        pathExtractionDebugLog(
          "[llm-path-analyzer][debug] --- user prompt (single-file job) ---\n",
          user,
        );
      }
    } else if (paths.length > 1) {
      pathExtractionDebugLog(
        `[llm-path-analyzer][debug] batch paths=${paths.length} startIndex=${startIndex} model=${model}`,
      );
      pathExtractionDebugLog("[llm-path-analyzer][debug] --- system prompt ---\n", system);
      pathExtractionDebugLog("[llm-path-analyzer][debug] --- user prompt ---\n", user);
    }
  }

  const body = buildPathLlmOllamaChatBody(paths, startIndex, model);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetch(chatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Ollama returned ${response.status}: ${await response.text()}`,
      );
    }

    const json = (await response.json()) as {
      message?: { content?: string };
    };
    const content = json.message?.content ?? "";
    const textContent = typeof content === "string" ? content : JSON.stringify(content);
    const textForLog = textContent.length > 0 ? textContent : "(empty message.content)";
    const isBulkRequest = paths.length > 1;
    if (!callOpts?.quiet && isPathExtractionDebugEnabled()) {
      if (callOpts?.debugLog) {
        if (isBulkRequest) {
          const sess = callOpts.debugLog;
          sess.rawContents.push(textContent);
          const k = sess.rawContents.length;
          pathExtractionDebugLog(
            `[llm-path-analyzer][debug] --- raw message.content (bulk Ollama response #${k}, pathsInRequest=${paths.length}, startIndex=${startIndex}) ---\n${textForLog}`,
          );
        }
      } else if (isBulkRequest) {
        pathExtractionDebugLog(
          `[llm-path-analyzer][debug] --- raw message.content (LLM bulk result) ---\n${textForLog}`,
        );
      }
    }
    return parseLlmResponse(textContent, paths.length, startIndex, callOpts);
  } finally {
    clearTimeout(timeout);
  }
}

function stripJsonFences(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence?.[1]) return fence[1].trim();
  return t;
}

/**
 * Normalize model JSON to an array of per-file objects.
 * @param expectedFileCount Batch size; a lone `{...}` is only accepted when this is 1 (Ollama single-object quirk).
 */
export function unwrapPathLlmChatJsonToArray(
  parsed: unknown,
  expectedFileCount: number,
  options?: { logMultiFileSingleObject?: boolean },
): unknown[] | null {
  const logMulti = options?.logMultiFileSingleObject !== false;
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const keys = [
    "results",
    "files",
    "items",
    "data",
    "extracted",
    "paths",
    "annotations",
    "metadata",
  ] as const;
  for (const k of keys) {
    const v = o[k];
    if (Array.isArray(v)) return v;
  }

  // Ollama `format: "json"` often returns one object for a single-file batch, not `[{…}]`.
  // For 2+ paths the model must return an array; never treat one object as N results.
  if (typeof o.index === "number") {
    const hasPathItemShape =
      o.date !== undefined ||
      o.location !== undefined ||
      o.display_title !== undefined;
    if (!hasPathItemShape) {
      return null;
    }
    if (expectedFileCount === 1) {
      return [parsed];
    }
    if (logMulti) {
      console.warn(
        `[llm-path-analyzer] model returned one JSON object for a ${expectedFileCount}-file batch (need an array of ${expectedFileCount} items); see preceding [llm-path-analyzer][debug] logs for prompt and raw response.`,
      );
    }
    return null;
  }

  return null;
}

function parseLlmResponse(
  content: string,
  expectedCount: number,
  startIndex: number,
  callOpts?: PathLlmCallOptions,
): LlmPathResult[] {
  try {
    let parsed = JSON.parse(stripJsonFences(content)) as unknown;
    const asArray = unwrapPathLlmChatJsonToArray(parsed, expectedCount, {
      logMultiFileSingleObject: !callOpts?.quiet,
    });
    if (!asArray) {
      if (!callOpts?.quiet) {
        const hint =
          parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? `keys=${Object.keys(parsed as object).join(",")}`
            : typeof parsed;
        console.warn(`[llm-path-analyzer] response is not a JSON array (or known wrapper); ${hint}`);
      }
      return emptyResults(expectedCount, startIndex);
    }
    parsed = asArray;

    const rows = (parsed as Record<string, unknown>[]).map((item, i) => ({
      index: typeof item.index === "number" ? item.index : startIndex + i + 1,
      date: parseDate(item.date),
      location: parseLocation(item.location),
      display_title:
        typeof item.display_title === "string" && item.display_title.trim()
          ? item.display_title.trim()
          : null,
    }));

    if (rows.length === expectedCount) {
      return rows;
    }
    if (expectedCount === 1 && rows.length > 0) {
      return [rows[0]!];
    }
    if (!callOpts?.quiet) {
      console.warn(
        `[llm-path-analyzer] JSON array has ${rows.length} element(s), expected ${expectedCount}; treating as failed batch`,
      );
    }
    return emptyResults(expectedCount, startIndex);
  } catch {
    if (!callOpts?.quiet) {
      console.warn("[llm-path-analyzer] failed to parse LLM response");
    }
    return emptyResults(expectedCount, startIndex);
  }
}

function parseDate(
  raw: unknown,
): LlmPathResult["date"] {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const start = typeof d.start === "string" ? d.start : null;
  if (!start) return null;
  const end = typeof d.end === "string" ? d.end : null;
  const precision = inferDatePrecision(start, end);
  return {
    start,
    end,
    precision,
  };
}

export function inferDatePrecision(
  start: string,
  end: string | null,
): "year" | "month" | "day" {
  const value = (end && end.trim()) || start.trim();
  if (/^\d{4}$/.test(value)) {
    return "year";
  }
  if (/^\d{4}-\d{2}$/.test(value)) {
    return "month";
  }
  return "day";
}

function parseLocation(
  raw: unknown,
): LlmPathResult["location"] {
  if (!raw || typeof raw !== "object") return null;
  const l = raw as Record<string, unknown>;
  const country = normalizeSingleLocationValue(l.country);
  const city = normalizeSingleLocationValue(l.city);
  const has = country || city || l.area;
  if (!has) return null;
  const consistent = normalizeCountryCityConsistency(country, city);
  return {
    country: consistent.country,
    country_code: typeof l.country_code === "string" ? l.country_code : null,
    area: typeof l.area === "string" ? l.area : null,
    city: consistent.city,
  };
}

function normalizeSingleLocationValue(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const text = raw.trim();
  if (!text) {
    return null;
  }
  // Defensive normalization in case the model still emits multiple places in one field.
  if (/[;,/]|(?:\s-\s)|(?:\s+and\s+)|(?:\s+or\s+)|(?:\s+&\s+)/i.test(text)) {
    return null;
  }
  return text;
}

function normalizeCountryCityConsistency(
  country: string | null,
  city: string | null,
): { country: string | null; city: string | null } {
  if (!country || !city) {
    return { country, city };
  }
  const c = country.trim().toLowerCase();
  const t = city.trim().toLowerCase();
  const cityToCountry = new Map<string, string>([
    ["paris", "france"],
    ["annecy", "france"],
    ["nice", "france"],
    ["geneva", "switzerland"],
    ["lausanne", "switzerland"],
    ["berlin", "germany"],
    ["munich", "germany"],
  ]);
  const expectedCountry = cityToCountry.get(t);
  if (expectedCountry && expectedCountry !== c) {
    return { country: null, city: null };
  }
  return { country, city };
}

function emptyResults(
  count: number,
  startIndex: number,
): LlmPathResult[] {
  return Array.from({ length: count }, (_, i) => ({
    index: startIndex + i + 1,
    date: null,
    location: null,
    display_title: null,
  }));
}

/**
 * Convert LLM result to PathExtractionMetadata for ai_metadata merge.
 */
export function llmResultToPathExtraction(
  result: LlmPathResult,
  model: string,
): PathExtractionMetadata {
  const now = new Date().toISOString();
  const meta: PathExtractionMetadata = {
    llm_extracted_at: now,
    llm_model: model,
  };

  if (result.date) {
    const date: PathDateExtraction = {
      start: result.date.start,
      end: result.date.end,
      precision: result.date.precision,
      source: "llm_path",
    };
    meta.date = date;
  }

  if (result.location) {
    const location: PathLocationExtraction = {
      country: result.location.country,
      country_code: result.location.country_code,
      area: result.location.area,
      city: result.location.city,
      source: "llm_path",
    };
    meta.location = location;
  }

  if (result.display_title) {
    meta.display_title = result.display_title;
  }

  return meta;
}

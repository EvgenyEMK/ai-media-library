/**
 * LLM-based query preprocessing for advanced image search.
 *
 * Uses a lightweight Ollama model (qwen2.5vl:3b, fallback qwen3.5:9b) to:
 * 1. Detect non-English queries and translate to English
 * 2. Extract 1-5 key visual concepts (keywords / short phrases)
 *
 * Falls back gracefully: if Ollama is unavailable, the model is missing,
 * or the response is malformed, returns `null` so the caller can proceed
 * with the raw query through the standard search pipeline.
 */

import {
  getOllamaBaseUrlForModelResolve,
  resolveOllamaTextChatModel,
  OLLAMA_TEXT_FALLBACK_MODEL,
  OLLAMA_TEXT_PRIMARY_MODEL,
} from "./ollama-model-resolve";

/** Max wait for the JSON analysis chat; 9b models often need 15–60s on cold load. */
function getQueryAnalysisTimeoutMs(): number {
  const raw = process.env.EMK_QUERY_ANALYSIS_TIMEOUT_MS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 10_000) return n;
  }
  return 90_000;
}

export interface QueryAnalysis {
  originalLanguage: string;
  translated: boolean;
  englishQuery: string;
  keywords: string[];
}

function getOllamaChatUrl(): string {
  return `${getOllamaBaseUrlForModelResolve()}/api/chat`;
}

// ── Model availability cache (reset each app launch) ───────────────
let cachedModel: string | null = null;
let modelResolvePromise: Promise<string | null> | null = null;

async function resolveModel(): Promise<string | null> {
  if (cachedModel) return cachedModel;

  if (modelResolvePromise) return modelResolvePromise;

  modelResolvePromise = (async () => {
    const picked = await resolveOllamaTextChatModel({});
    if (picked) {
      cachedModel = picked;
      console.log(`[query-understanding] using Ollama model: ${cachedModel} (from /api/tags)`);
    }
    return cachedModel;
  })();

  const result = await modelResolvePromise;
  modelResolvePromise = null;
  return result;
}

// ── Prompt ──────────────────────────────────────────────────────────
// NOTE: Do not put instruction-like placeholder text inside JSON examples — VLMs often copy it verbatim.

const QUERY_UNDERSTANDING_SYSTEM = [
  "You output one JSON object only. No markdown fences, no commentary.",
  "",
  "Fields:",
  "- original_language: ISO 639-1 code of the user's text (en, ru, de, …).",
  "- translated: true if the query was not English; false if it was already English.",
  "- english_query: The user's intent as fluent English (short phrase or sentence).",
  "  This must be REAL English words describing the scene — never instructions, never placeholders,",
  '  never the phrase "same as input", never schema text.',
  "- keywords: 1–5 short English noun phrases for search against English image captions.",
  "  Use Latin letters only. Merge compounds when needed (paper castle, not paper + castle).",
  "  Order by importance; avoid near-duplicates.",
  "",
  "Example (input was German):",
  'Input: ein kleiner Junge in einer Papienburg',
  '{"original_language":"de","translated":true,"english_query":"a small boy in a paper castle","keywords":["small boy","paper castle"]}',
].join("\n");

function buildUserPrompt(userQuery: string): string {
  return [
    "User search query (any language):",
    "---",
    userQuery,
    "---",
    "",
    "Respond with JSON: original_language, translated, english_query, keywords.",
  ].join("\n");
}

/** Exported for manual Ollama / script tests — same strings the app uses. */
export function getQueryUnderstandingPrompts(userQuery: string): {
  system: string;
  user: string;
} {
  return { system: QUERY_UNDERSTANDING_SYSTEM, user: buildUserPrompt(userQuery) };
}

// ── Public API ──────────────────────────────────────────────────────

function stripJsonFences(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence?.[1]) return fence[1].trim();
  return t;
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function pickStringArray(obj: Record<string, unknown>, ...keys: string[]): string[] {
  for (const k of keys) {
    const v = obj[k];
    if (!Array.isArray(v)) continue;
    const out = v
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim())
      .slice(0, 5);
    if (out.length > 0) return out;
  }
  return [];
}

function parseQueryAnalysisJson(
  raw: string,
  fallbackQuery: string,
): QueryAnalysis | null {
  const cleaned = stripJsonFences(raw);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch (e) {
    console.log(
      "[query-understanding] JSON.parse failed:",
      e instanceof Error ? e.message : String(e),
    );
    console.log("[query-understanding] raw content (first 800 chars):", cleaned.slice(0, 800));
    return null;
  }

  const originalLanguage =
    pickString(parsed, "original_language", "originalLanguage") ?? "en";
  const translatedRaw = parsed.translated;
  const translated =
    typeof translatedRaw === "boolean"
      ? translatedRaw
      : originalLanguage.toLowerCase() !== "en";

  const englishQuery =
    pickString(parsed, "english_query", "englishQuery") ?? fallbackQuery;

  const keywords = pickStringArray(parsed, "keywords", "key_concepts", "keyConcepts");

  if (isPlaceholderEnglishQuery(englishQuery)) {
    console.log(
      "[query-understanding] rejected parse: english_query looks like copied instructions:",
      englishQuery.slice(0, 120),
    );
    return null;
  }
  if (hasNonLatinScript(englishQuery)) {
    console.log(
      "[query-understanding] rejected parse: english_query must be English (Latin script only)",
    );
    return null;
  }
  if (keywords.length > 0 && keywords.some((k) => hasNonLatinScript(k))) {
    console.log(
      "[query-understanding] rejected parse: keywords must be English phrases (found non-Latin script)",
    );
    return null;
  }

  return { originalLanguage, translated, englishQuery, keywords };
}

/** True if string contains Cyrillic, CJK, Arabic, etc. — keywords/query for embedding must be English. */
function hasNonLatinScript(s: string): boolean {
  // Cyrillic, Arabic, Hebrew, CJK unified
  return /[\u0400-\u04FF\u0600-\u06FF\u0590-\u05FF\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/.test(
    s,
  );
}

function isPlaceholderEnglishQuery(s: string): boolean {
  const t = s.toLowerCase();
  if (t.includes("same as input")) return true;
  if (t.includes("the query in english") && t.includes("already")) return true;
  if (/original_language|iso 639-1|keyword1|keyword or phrase/i.test(s)) return true;
  return false;
}

/**
 * Analyze a user search query via a lightweight LLM.
 * Returns `null` on any failure so the caller can fall back to the raw query.
 */
export async function analyzeSearchQuery(
  query: string,
  signal?: AbortSignal,
): Promise<{ analysis: QueryAnalysis; model: string } | null> {
  const logPrefix = "[query-understanding]";
  try {
    const model = await resolveModel();
    if (!model) {
      console.log(
        `${logPrefix} no Ollama model resolved (tried ${OLLAMA_TEXT_PRIMARY_MODEL}, ${OLLAMA_TEXT_FALLBACK_MODEL})`,
      );
      return null;
    }

    const analysisTimeoutMs = getQueryAnalysisTimeoutMs();
    const timeout = AbortSignal.timeout(analysisTimeoutMs);
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeout])
      : timeout;

    const response = await fetch(getOllamaChatUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: combinedSignal,
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: QUERY_UNDERSTANDING_SYSTEM },
          { role: "user", content: buildUserPrompt(query) },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.log(
        `${logPrefix} HTTP ${response.status} from Ollama:`,
        errText.slice(0, 500),
      );
      return null;
    }

    const body = (await response.json()) as {
      message?: { content?: string | object };
    };
    const content = body.message?.content;
    const raw =
      typeof content === "string"
        ? content
        : content != null
          ? JSON.stringify(content)
          : "";
    if (!raw) {
      console.log(`${logPrefix} empty message.content; full body keys:`, Object.keys(body));
      return null;
    }

    console.log(`${logPrefix} LLM raw output (copy for debug):\n${raw}`);

    const analysis = parseQueryAnalysisJson(raw, query);
    if (!analysis) return null;

    console.log(
      `${logPrefix} parsed — language=${analysis.originalLanguage} translated=${analysis.translated} english_query="${analysis.englishQuery}" keywords=[${analysis.keywords.map((k) => JSON.stringify(k)).join(", ")}]`,
    );

    return { analysis, model };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`${logPrefix} error:`, msg);
    if (/aborted|timeout/i.test(msg)) {
      console.log(
        `${logPrefix} hint: increase EMK_QUERY_ANALYSIS_TIMEOUT_MS (current default ${getQueryAnalysisTimeoutMs()}ms); 9b models are slow on first run.`,
      );
    }
    return null;
  }
}

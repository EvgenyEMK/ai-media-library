/**
 * Resolve a **text** chat model via Ollama `GET /api/tags`.
 * Used by advanced search query understanding and path-metadata LLM so both pick
 * whatever Qwen-family model is actually installed (avoids hard-coded names
 * like `qwen2.5:7b` that often return HTTP 404).
 */

export const OLLAMA_TEXT_PRIMARY_MODEL = "qwen2.5vl:3b";
export const OLLAMA_TEXT_FALLBACK_MODEL = "qwen3.5:9b";

const TAGS_LIST_TIMEOUT_MS = 10_000;
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";

export function getOllamaBaseUrlForModelResolve(): string {
  const raw =
    process.env.EMK_OLLAMA_BASE_URL?.trim() ?? process.env.EMK_OLLAMA_URL?.trim() ?? "";
  return raw.replace(/\/+$/, "") || DEFAULT_OLLAMA_BASE_URL;
}

export interface ResolveOllamaTextChatModelOptions {
  /** Exact name from `ollama list`; must appear in `/api/tags` or it is skipped with a warning. */
  preferred?: string | null;
  /** Overrides default primary (defaults to {@link OLLAMA_TEXT_PRIMARY_MODEL}). */
  primaryModelId?: string | null;
  /** Overrides default fallback (defaults to {@link OLLAMA_TEXT_FALLBACK_MODEL}). */
  fallbackModelId?: string | null;
}

/**
 * Pick an installed model: optional user preference (if present locally), then the same
 * priority order as `query-understanding.ts` used historically.
 */
export async function resolveOllamaTextChatModel(
  options: ResolveOllamaTextChatModelOptions = {},
): Promise<string | null> {
  const preferred = options.preferred?.trim();
  const primaryConfigured = options.primaryModelId?.trim() || OLLAMA_TEXT_PRIMARY_MODEL;
  const fallbackConfigured = options.fallbackModelId?.trim() || OLLAMA_TEXT_FALLBACK_MODEL;
  try {
    const url = `${getOllamaBaseUrlForModelResolve()}/api/tags`;
    const res = await fetch(url, { signal: AbortSignal.timeout(TAGS_LIST_TIMEOUT_MS) });
    if (!res.ok) {
      console.log("[ollama-model-resolve] /api/tags HTTP", res.status);
      return null;
    }
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const names = (data.models ?? []).map((m) => m.name);

    if (preferred) {
      if (names.includes(preferred)) {
        return preferred;
      }
      console.warn(
        `[ollama-model-resolve] preferred model "${preferred}" not in Ollama; auto-picking from ${names.length} installed model(s) (same as AI search query understanding).`,
      );
    }

    if (names.includes(primaryConfigured)) {
      return primaryConfigured;
    }
    if (names.includes(fallbackConfigured)) {
      return fallbackConfigured;
    }
    if (names.includes("qwen2.5:3b")) {
      return "qwen2.5:3b";
    }
    const soft25vl_3b = names.find((n) => /^qwen2\.5vl/i.test(n) && /3b/i.test(n));
    if (soft25vl_3b) return soft25vl_3b;
    const soft25_3b = names.find((n) => /^qwen2\.5/i.test(n) && /3b/i.test(n));
    if (soft25_3b) return soft25_3b;
    const soft35_9b = names.find((n) => /qwen3\.?5/i.test(n) && /9b/i.test(n));
    if (soft35_9b) return soft35_9b;

    console.log(
      "[ollama-model-resolve] no matching Qwen text model in /api/tags; have:",
      names.slice(0, 20).join(", "),
      names.length > 20 ? `… (+${names.length - 20} more)` : "",
    );
    return null;
  } catch (e) {
    console.log(
      "[ollama-model-resolve] /api/tags failed:",
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}

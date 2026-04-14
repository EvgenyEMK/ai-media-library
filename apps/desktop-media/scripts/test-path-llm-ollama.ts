/**
 * Call Ollama with the same system/user prompts and body as path-metadata LLM extraction.
 *
 * From repo root:
 *   pnpm exec tsx apps/desktop-media/scripts/test-path-llm-ollama.ts
 * From apps/desktop-media:
 *   pnpm exec tsx scripts/test-path-llm-ollama.ts
 *
 * For the **15-path production batch** (same fixture as the app), use:
 *   pnpm run test:path-llm-ollama-batch
 *
 * Args: optional file paths (one per arg). Default: one sample path under a Cyrillic/Latin folder name.
 * Flags: --model <id>  (else OLLAMA_MODEL env, else /api/tags auto-pick like the app)
 *
 * Env: EMK_OLLAMA_BASE_URL, EMK_OLLAMA_URL, OLLAMA_MODEL
 */
import {
  getPathLlmChatPrompts,
  unwrapPathLlmChatJsonToArray,
} from "../electron/path-extraction/llm-path-analyzer";
import {
  getOllamaBaseUrlForModelResolve,
  resolveOllamaTextChatModel,
} from "../electron/ollama-model-resolve";

const DEFAULT_SAMPLE_PATHS = [
  "C:\\EMK-Media\\Photo 2000--2005\\2002\\2002-05-09 Anncy-France , Billard in Geneva\\DSC_0001.jpg",
];

function parseCli(): { modelFlag: string | null; paths: string[] } {
  const raw = process.argv.slice(2);
  const paths: string[] = [];
  let modelFlag: string | null = null;
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (a === "--model" && raw[i + 1]) {
      modelFlag = raw[++i].trim();
      continue;
    }
    if (a.startsWith("--model=")) {
      modelFlag = a.slice("--model=".length).trim();
      continue;
    }
    paths.push(a);
  }
  return { modelFlag, paths };
}

async function main(): Promise<void> {
  const { modelFlag, paths: pathArgs } = parseCli();
  const paths = pathArgs.length > 0 ? pathArgs : DEFAULT_SAMPLE_PATHS;

  const envModel = process.env.OLLAMA_MODEL?.trim() || null;
  const preferred = modelFlag || envModel || null;
  const model = await resolveOllamaTextChatModel({ preferred });

  if (!model) {
    console.error("No Ollama text model resolved. Start Ollama and pull e.g. qwen2.5vl:3b.");
    process.exit(1);
  }

  const base = getOllamaBaseUrlForModelResolve();
  const { system, user } = getPathLlmChatPrompts(paths, 0);

  console.log("Base URL:", base);
  console.log("Model:", model);
  console.log("--- user message ---\n", user, "\n---");

  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      options: { temperature: 0.1 },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  const body = (await res.json()) as { message?: { content?: string } };
  console.log("HTTP", res.status);
  const content = body.message?.content ?? "";
  console.log("message.content (raw):\n", content);

  try {
    const parsed = JSON.parse(
      content
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, ""),
    );
    console.log("Parsed typeof:", Array.isArray(parsed) ? "array" : typeof parsed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      console.log("Parsed keys:", Object.keys(parsed as object));
    }
    const coerced = unwrapPathLlmChatJsonToArray(parsed, paths.length);
    console.log(
      "After app unwrap (production):",
      coerced == null ? "null" : `array length=${coerced.length}`,
    );
  } catch {
    console.log("(Could not JSON.parse content after fence strip — model may have returned non-JSON.)");
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});

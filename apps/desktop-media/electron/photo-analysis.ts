import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Jimp } from "jimp";
import type { DocumentData, PhotoAnalysisOutput } from "../src/shared/ipc";
import {
  INVOICE_DATA_EXTRACTION_PROMPT,
  PHOTO_ANALYSIS_PROMPT,
  PHOTO_ANALYSIS_PROMPT_VERSION,
} from "../src/shared/photo-analysis-prompt";
import { parseAnalysisJson } from "./photo-analysis-parser";

const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "qwen3.5:9b";
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_OLLAMA_TEMPERATURE = 0.15;
const DEFAULT_OLLAMA_SEED = 42;
const DEFAULT_OLLAMA_TOP_P = 0.9;
const DEFAULT_OLLAMA_TOP_K = 40;

interface AnalyzeWithOllamaParams {
  imagePath: string;
  model?: string;
  think?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface AnalyzeWithCustomPromptParams extends AnalyzeWithOllamaParams {
  prompt: string;
}

export type QuarterTurnAngle = 90 | 180 | 270;

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
}

interface OllamaRequestOptions {
  temperature?: number;
  seed?: number;
  top_p?: number;
  top_k?: number;
}

function getOllamaBaseUrl(): string {
  const raw = process.env.EMK_OLLAMA_BASE_URL ?? process.env.EMK_OLLAMA_URL ?? "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_OLLAMA_BASE_URL;
}

function getOllamaChatUrl(): string {
  return `${getOllamaBaseUrl()}/api/chat`;
}

export function getDefaultVisionModel(): string {
  return DEFAULT_MODEL;
}

export function getPhotoAnalysisPromptVersion(): string {
  return PHOTO_ANALYSIS_PROMPT_VERSION;
}

type WarmupOutcome = { ok: true } | { ok: false; error: string };
const warmupByModel = new Map<string, Promise<WarmupOutcome>>();

/**
 * Ensure Ollama has the given model loaded and ready to answer requests.
 * This prevents the "first N images fail on startup" issue when the model
 * is still initializing.
 */
export async function warmupOllamaVisionModel(params: {
  model: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<void> {
  const model = params.model.trim();
  if (!model) {
    throw new Error("Warmup requires a model name");
  }

  const existing = warmupByModel.get(model);
  if (existing) {
    const res = await existing;
    if (!res.ok) throw new Error(res.error);
    return;
  }

  const run = (async (): Promise<WarmupOutcome> => {
    const timeoutMs = typeof params.timeoutMs === "number" ? params.timeoutMs : 60_000;
    const start = Date.now();
    let attempt = 0;
    let lastErr: string | null = null;

    while (Date.now() - start < timeoutMs) {
      if (params.signal?.aborted) {
        return { ok: false, error: "Warmup cancelled" };
      }
      attempt += 1;
      try {
        const response = await fetch(getOllamaChatUrl(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-emk-purpose": "warmup",
          },
          signal: params.signal,
          body: JSON.stringify({
            model,
            stream: false,
            format: "json",
            messages: [{ role: "user", content: "Return a minimal valid JSON object." }],
          }),
        });

        if (response.ok) {
          return { ok: true };
        }

        const text = await response.text().catch(() => "");
        lastErr = extractErrorMessage(text) || `HTTP ${response.status}`;
      } catch (error) {
        lastErr = error instanceof Error ? error.message : String(error);
      }

      // Exponential backoff with a small cap.
      const delayMs = Math.min(2_000, 250 * Math.pow(2, Math.min(4, attempt - 1)));
      await new Promise((r) => setTimeout(r, delayMs));
    }

    return {
      ok: false,
      error: `Ollama model warmup timed out for '${model}' (${lastErr ?? "unknown error"})`,
    };
  })().finally(() => {
    // Reset on failure so the next run can retry.
    // Keep successful warmups cached to avoid extra work.
    void (async () => {
      const res = await warmupByModel.get(model);
      if (!res) return;
      const out = await res;
      if (!out.ok) {
        warmupByModel.delete(model);
      }
    })();
  });

  warmupByModel.set(model, run);
  const res = await run;
  if (!res.ok) {
    throw new Error(res.error);
  }
}

export async function analyzePhotoWithOllama({
  imagePath,
  model = DEFAULT_MODEL,
  think,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal,
}: AnalyzeWithOllamaParams): Promise<PhotoAnalysisOutput> {
  const rawContent = await analyzePhotoWithOllamaPrompt({
    imagePath,
    model,
    think,
    timeoutMs,
    signal,
    prompt: PHOTO_ANALYSIS_PROMPT,
  });
  const parsed = parseAnalysisJson(rawContent);

  const result = {
    ...(parsed as Omit<PhotoAnalysisOutput, "modelInfo">),
    modelInfo: {
      model,
      promptVersion: PHOTO_ANALYSIS_PROMPT_VERSION,
      timestamp: new Date().toISOString(),
    },
  } as PhotoAnalysisOutput;
  return result;
}

export async function extractInvoiceDocumentDataWithOllama({
  imagePath,
  model = DEFAULT_MODEL,
  think,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal,
}: AnalyzeWithOllamaParams): Promise<DocumentData | null> {
  const rawContent = await analyzePhotoWithOllamaPrompt({
    imagePath,
    model,
    think,
    timeoutMs,
    signal,
    prompt: INVOICE_DATA_EXTRACTION_PROMPT,
  });
  const parsed = parseJsonObjectFromModelContent(rawContent);
  if (!parsed) {
    return null;
  }
  return {
    invoice_issuer: ensureNullableString(parsed.invoice_issuer),
    invoice_number: ensureNullableString(parsed.invoice_number),
    invoice_date: ensureNullableString(parsed.invoice_date),
    client_number: ensureNullableString(parsed.client_number),
    invoice_total_amount: ensureNullableNumber(parsed.invoice_total_amount),
    invoice_total_amount_currency: ensureNullableString(parsed.invoice_total_amount_currency),
    vat_percent: ensureNullableNumber(parsed.vat_percent),
    vat_amount: ensureNullableNumber(parsed.vat_amount),
  };
}

async function analyzePhotoWithOllamaPrompt({
  imagePath,
  model = DEFAULT_MODEL,
  think,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal,
  prompt,
}: AnalyzeWithCustomPromptParams): Promise<string> {
  const promptForRequest =
    process.env.EMK_E2E_ANALYSIS_APPENDED_BASENAME === "1"
      ? `${prompt}\n\nFilename: ${path.basename(imagePath)}`
      : prompt;
  const imageBytes = await fs.readFile(imagePath);
  const imageBase64 = imageBytes.toString("base64");
  const ollamaOptions = getOllamaRequestOptionsFromEnv();
  const debug = process.env.EMK_DEBUG_PHOTO_AI === "1";

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort();
  }, timeoutMs);

  const abortController = new AbortController();
  const relayAbort = () => abortController.abort();
  signal?.addEventListener("abort", relayAbort);
  timeoutController.signal.addEventListener("abort", relayAbort);

  const maxAttempts = 3;
  let attempt = 0;
  let lastError: unknown = null;

  const shouldRetry = (err: unknown): boolean => {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    // Observed in your logs: "unexpected EOF" and intermittent sequence creation failures.
    if (msg.includes("unexpected eof")) return true;
    if (msg.includes("failed to create new sequence")) return true;
    // Common transient network/daemon issues.
    if (msg.includes("unable to reach ollama")) return true;
    if (msg.includes("ollama request failed with http 5")) return true;
    if (msg.includes("fetch failed")) return true;
    return false;
  };

  try {
    while (attempt < maxAttempts) {
      attempt += 1;
      const attemptT0 = Date.now();
      try {
        const response = await fetch(getOllamaChatUrl(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: abortController.signal,
          body: JSON.stringify({
            model,
            stream: false,
            format: "json",
            ...(ollamaOptions ? { options: ollamaOptions } : {}),
            ...(typeof think === "boolean" ? { think } : {}),
            messages: [
              {
                role: "user",
                content: promptForRequest,
                images: [imageBase64],
              },
            ],
          }),
        });

        if (!response.ok) {
          const responseText = await response.text();
          const maybeMessage = extractErrorMessage(responseText);
          if (response.status === 404 && maybeMessage.toLowerCase().includes("model")) {
            throw new Error(`Model '${model}' is not available in Ollama. Pull it first.`);
          }
          throw new Error(
            maybeMessage || `Ollama request failed with HTTP ${response.status}`,
          );
        }

        const payload = (await response.json()) as OllamaChatResponse;
        const rawContent = payload.message?.content ?? "";
        return rawContent;
      } catch (error) {
        lastError = error;
        if (abortController.signal.aborted) {
          throw error;
        }
        if (attempt >= maxAttempts || !shouldRetry(error)) {
          throw error;
        }

        const delayMs = 400 * attempt;
        if (debug) {
          console.log(
            `[photo-ai][ollama] retrying attempt=${attempt + 1}/${maxAttempts} model="${model}" delayMs=${delayMs} elapsedMs=${Date.now() - attemptT0} error="${error instanceof Error ? error.message : String(error)}"`,
          );
        }
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Ollama request failed");
  } catch (error) {
    if (abortController.signal.aborted) {
      if (signal?.aborted) {
        throw new Error("Analysis cancelled");
      }
      if (timeoutController.signal.aborted) {
        if (debug) {
          console.log(
            `[photo-ai][ollama][timeout] model="${model}" timeoutMs=${timeoutMs} file="${imagePath}" attempt=${attempt}/${maxAttempts}`,
          );
        }
        throw new Error("Analysis timed out");
      }
      throw new Error("Analysis aborted");
    }

    if (error instanceof Error && error.message.includes("fetch")) {
      throw new Error(`Unable to reach Ollama at ${getOllamaBaseUrl()}`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", relayAbort);
    timeoutController.signal.removeEventListener("abort", relayAbort);
  }
}

function getOllamaRequestOptionsFromEnv(): OllamaRequestOptions | null {
  const temperature =
    parseEnvNumber("OLLAMA_TEMPERATURE") ?? DEFAULT_OLLAMA_TEMPERATURE;
  const seed = parseEnvInteger("OLLAMA_SEED") ?? DEFAULT_OLLAMA_SEED;
  const topP = parseEnvNumber("OLLAMA_TOP_P") ?? DEFAULT_OLLAMA_TOP_P;
  const topK = parseEnvInteger("OLLAMA_TOP_K") ?? DEFAULT_OLLAMA_TOP_K;

  return {
    temperature,
    seed,
    top_p: topP,
    top_k: topK,
  };
}

function parseEnvNumber(name: string): number | null {
  const raw = process.env[name];
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function parseEnvInteger(name: string): number | null {
  const raw = process.env[name];
  if (typeof raw !== "string" || raw.trim() === "") {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

export async function createRotatedTempImage(
  imagePath: string,
  angleClockwise: QuarterTurnAngle,
): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const imageBytes = await fs.readFile(imagePath);
  const image = await Jimp.read(imageBytes);
  // Jimp's positive rotation direction is opposite to our clockwise contract.
  // Convert clockwise quarter-turn to Jimp degrees to keep two-pass checks accurate.
  const jimpRotationDegrees =
    angleClockwise === 90 ? 270 : angleClockwise === 270 ? 90 : 180;
  image.rotate(jimpRotationDegrees);
  const tempPath = path.join(
    os.tmpdir(),
    `emk-photo-analysis-rotated-${angleClockwise}-${randomUUID()}.jpg`,
  ) as `${string}.jpg`;
  await image.write(tempPath);
  return {
    path: tempPath,
    cleanup: async () => {
      try {
        await fs.unlink(tempPath);
      } catch {
        // Best-effort cleanup.
      }
    },
  };
}

function parseJsonObjectFromModelContent(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();
  const blockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = blockMatch?.[1]?.trim() || trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  const jsonText = start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function ensureNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function ensureNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractErrorMessage(responseText: string): string {
  try {
    const parsed = JSON.parse(responseText) as { error?: unknown };
    if (typeof parsed.error === "string") {
      return parsed.error;
    }
  } catch {
    // Ignore JSON parse errors.
  }
  return responseText.trim();
}

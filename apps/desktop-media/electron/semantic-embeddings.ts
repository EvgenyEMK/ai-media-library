import fs from "node:fs/promises";
import { getDefaultVisionModel } from "./photo-analysis";

const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
function getOllamaBaseUrl(): string {
  const raw = process.env.EMK_OLLAMA_BASE_URL ?? process.env.EMK_OLLAMA_URL ?? "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed || DEFAULT_OLLAMA_BASE_URL;
}

const OLLAMA_EMBED_ENDPOINT = `${getOllamaBaseUrl()}/api/embed`;
const OLLAMA_CHAT_ENDPOINT = `${getOllamaBaseUrl()}/api/chat`;
export const MULTIMODAL_EMBED_MODEL = "DC1LEX/nomic-embed-text-v1.5-multimodal";

const IMAGE_CAPTION_PROMPT =
  "Describe this image in 2-3 concise sentences. " +
  "Focus on the main subjects, their actions, the setting/location, " +
  "and any notable visual elements. Be specific about what you see.";

interface EmbedApiResponse {
  embedding?: number[];
  embeddings?: number[][];
  error?: string;
}

interface OllamaChatResponse {
  message?: { content?: string };
}

export async function embedText(text: string, model = MULTIMODAL_EMBED_MODEL): Promise<number[]> {
  const payload = {
    model,
    input: text,
  };
  const vector = await requestEmbedding(payload);
  return normalizeVector(vector);
}

/**
 * Generates a short text description of an image using a vision model,
 * then returns a text embedding of that description.
 *
 * Ollama's /api/embed does not support image inputs (as of 2026), so we
 * use the vision model via /api/chat to produce a caption first, then
 * embed the caption text with the text embedding model.
 */
export async function embedImageViaDescription(
  imagePath: string,
  options?: {
    visionModel?: string;
    embedModel?: string;
    signal?: AbortSignal;
  },
): Promise<{ vector: number[]; caption: string }> {
  const caption = await describeImageForEmbedding(imagePath, {
    visionModel: options?.visionModel,
    signal: options?.signal,
  });
  const vector = await embedText(caption, options?.embedModel ?? MULTIMODAL_EMBED_MODEL);
  return { vector, caption };
}

/**
 * Calls a vision-capable model via /api/chat to produce a short text
 * caption for the given image.
 */
export async function describeImageForEmbedding(
  imagePath: string,
  options?: {
    visionModel?: string;
    signal?: AbortSignal;
  },
): Promise<string> {
  const visionModel = options?.visionModel ?? getDefaultVisionModel();
  const imageBytes = await fs.readFile(imagePath);
  const imageBase64 = imageBytes.toString("base64");

  const response = await fetch(OLLAMA_CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: options?.signal,
    body: JSON.stringify({
      model: visionModel,
      stream: false,
      options: { temperature: 0.2, seed: 42 },
      messages: [
        {
          role: "user",
          content: IMAGE_CAPTION_PROMPT,
          images: [imageBase64],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Vision caption failed (HTTP ${response.status}): ${text.slice(0, 200)}`,
    );
  }

  const data = (await response.json()) as OllamaChatResponse;
  const rawCaption = data?.message?.content ?? "";
  const caption = stripThinkingTags(rawCaption).trim();
  if (caption.length === 0) {
    throw new Error("Vision model returned empty caption");
  }
  return caption;
}

export async function probeMultimodalEmbeddingSupport(
  model = MULTIMODAL_EMBED_MODEL,
): Promise<{
  model: string;
  textEmbeddingReady: boolean;
  visionModelReady: boolean;
  lastProbeError: string | null;
}> {
  let textEmbeddingReady = false;
  let visionModelReady = false;
  let lastProbeError: string | null = null;

  try {
    const textVector = await embedText("semantic search probe", model);
    textEmbeddingReady = textVector.length > 0;
  } catch (error) {
    lastProbeError = error instanceof Error ? error.message : "Text embedding probe failed";
  }

  try {
    const visionModel = getDefaultVisionModel();
    const response = await fetch(OLLAMA_CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: visionModel,
        stream: false,
        messages: [{ role: "user", content: "Say OK" }],
      }),
    });
    visionModelReady = response.ok;
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      lastProbeError = `Vision model '${visionModel}' not available: ${text.slice(0, 200)}`;
    }
  } catch (error) {
    if (!lastProbeError) {
      lastProbeError = error instanceof Error ? error.message : "Vision model probe failed";
    }
  }

  return {
    model,
    textEmbeddingReady,
    visionModelReady,
    lastProbeError,
  };
}

async function requestEmbedding(
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<number[]> {
  const response = await fetch(OLLAMA_EMBED_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Ollama embed API failed with HTTP ${response.status}`);
  }

  const data = (await response.json()) as EmbedApiResponse;
  if (typeof data.error === "string" && data.error.length > 0) {
    throw new Error(data.error);
  }

  if (Array.isArray(data.embedding) && data.embedding.every((n) => typeof n === "number")) {
    return data.embedding;
  }

  if (
    Array.isArray(data.embeddings) &&
    data.embeddings.length > 0 &&
    Array.isArray(data.embeddings[0]) &&
    data.embeddings[0].every((n) => typeof n === "number")
  ) {
    return data.embeddings[0];
  }

  throw new Error("Invalid embedding response payload from Ollama");
}

function normalizeVector(values: number[]): number[] {
  let sumSquares = 0;
  for (const value of values) {
    sumSquares += value * value;
  }
  if (sumSquares === 0) {
    return values;
  }
  const norm = Math.sqrt(sumSquares);
  return values.map((value) => value / norm);
}

function stripThinkingTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

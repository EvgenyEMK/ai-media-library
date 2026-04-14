/**
 * Embedding provider adapter — abstracts text/image embedding generation.
 *
 * Desktop implementation: Ollama local models (e.g., nomic-embed-text-v1.5-multimodal).
 * Web implementation: Cloud embedding APIs (OpenAI, Cohere, etc.).
 */

export type EmbeddingInputType = "text" | "image";

export interface EmbeddingRequest {
  inputType: EmbeddingInputType;
  text?: string;
  /** Absolute file path (desktop) or base64-encoded image data (web). */
  imageData?: string;
  model?: string;
  signal?: AbortSignal;
}

export interface EmbeddingResult {
  vector: number[];
  model: string;
  dimensions: number;
}

export interface EmbeddingProviderCapabilities {
  supportsText: boolean;
  supportsImage: boolean;
  defaultModel: string;
}

export interface EmbeddingProviderStatus {
  model: string;
  textEmbeddingReady: boolean;
  /** @deprecated Use visionModelReady. Ollama /api/embed does not support images. */
  imageEmbeddingReady?: boolean;
  visionModelReady: boolean;
  lastProbeError: string | null;
}

export interface EmbeddingProviderAdapter {
  providerId: string;
  capabilities: EmbeddingProviderCapabilities;

  /** Generate an embedding vector for the given input. */
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;

  /** Probe whether the provider is reachable and which modalities are available. */
  probeStatus(): Promise<EmbeddingProviderStatus>;
}

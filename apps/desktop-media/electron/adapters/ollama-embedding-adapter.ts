import type {
  EmbeddingProviderAdapter,
  EmbeddingProviderCapabilities,
  EmbeddingProviderStatus,
  EmbeddingRequest,
  EmbeddingResult,
} from "@emk/shared-contracts";
import {
  // embedImageViaDescription,  // VLM caption fallback — kept for future use
  // embedText,                  // Ollama text embedding — replaced by ONNX embedTextDirect
  MULTIMODAL_EMBED_MODEL,
  probeMultimodalEmbeddingSupport,
} from "../semantic-embeddings";
import { embedImageDirect, embedTextDirect, probeVisionEmbeddingReady } from "../nomic-vision-embedder";

export class OllamaEmbeddingAdapter implements EmbeddingProviderAdapter {
  readonly providerId = "ollama-local";

  readonly capabilities: EmbeddingProviderCapabilities = {
    supportsText: true,
    supportsImage: true,
    defaultModel: MULTIMODAL_EMBED_MODEL,
  };

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const model = request.model ?? MULTIMODAL_EMBED_MODEL;

    let vector: number[];
    if (request.inputType === "text") {
      if (!request.text) {
        throw new Error("EmbeddingRequest: text is required for text embeddings");
      }
      vector = await embedTextDirect(request.text, request.signal);
    } else {
      if (!request.imageData) {
        throw new Error("EmbeddingRequest: imageData (file path) is required for image embeddings");
      }
      vector = await embedImageDirect(request.imageData, request.signal);
      // VLM caption fallback — commented out; direct vision is the primary method.
      // try {
      //   vector = await embedImageDirect(request.imageData, request.signal);
      // } catch {
      //   const result = await embedImageViaDescription(request.imageData, {
      //     embedModel: model,
      //     signal: request.signal,
      //   });
      //   vector = result.vector;
      // }
    }

    return { vector, model, dimensions: vector.length };
  }

  async probeStatus(): Promise<EmbeddingProviderStatus> {
    const base = await probeMultimodalEmbeddingSupport(MULTIMODAL_EMBED_MODEL);
    const visionOnnxReady = await probeVisionEmbeddingReady();
    return {
      ...base,
      visionOnnxReady,
    } as EmbeddingProviderStatus & { visionOnnxReady: boolean };
  }
}

export type AiExecutionMode = "local" | "cloud";

export interface AiProviderRequest {
  mediaPath: string;
  promptTemplate: string;
  maxLabels?: number;
  locale?: string;
}

export interface AiProviderResult {
  labels: string[];
  caption?: string;
  confidence?: number;
  raw?: Record<string, unknown>;
}

export interface AiProviderCapabilities {
  mode: AiExecutionMode;
  supportsVision: boolean;
  supportsBatch: boolean;
  supportsStructuredOutput: boolean;
}

export interface AiProviderAdapter {
  providerId: string;
  model: string;
  capabilities: AiProviderCapabilities;
  analyzePhoto(input: AiProviderRequest): Promise<AiProviderResult>;
}

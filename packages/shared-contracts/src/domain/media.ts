export type MediaId = string;
export type MediaLibraryId = string;
export type MediaChecksum = string;

export interface MediaSource {
  provider: "local-filesystem" | "supabase-storage" | "s3-compatible";
  path: string;
  mimeType: string;
  sizeBytes: number;
}

export interface MediaDimensions {
  width: number;
  height: number;
}

export interface MediaIdentity {
  mediaId: MediaId;
  checksumSha256: MediaChecksum;
  capturedAt?: string;
  importedAt: string;
  source: MediaSource;
}

export interface MediaMetadata {
  title?: string;
  description?: string;
  tags: string[];
  dimensions?: MediaDimensions;
  durationMs?: number;
}

export interface AiAnnotation {
  provider: "ollama" | "openai" | "azure-openai" | "custom";
  model: string;
  createdAt: string;
  labels: string[];
  caption?: string;
  confidence?: number;
}

export interface MediaRecord {
  libraryId: MediaLibraryId;
  identity: MediaIdentity;
  metadata: MediaMetadata;
  ai: AiAnnotation[];
}

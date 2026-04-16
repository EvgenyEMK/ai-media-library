// ── Task / Progress ──────────────────────────────────────────────

export type TaskStatus = "idle" | "running" | "completed" | "failed" | "cancelled";

export type TaskType = "metadataScan" | "aiAnalysis" | "faceDetection" | "semanticIndexing";

export interface TaskProgress {
  taskId: string;
  type: TaskType;
  status: TaskStatus;
  label: string;
  processedCount: number;
  totalCount: number;
  errors: number;
  averageSecondsPerItem: number | null;
  startedAt: number | null;
}

// ── Processing item status (shared across metadata / AI / face) ─

export type ProcessingItemStatus = "pending" | "running" | "success" | "failed" | "cancelled";

// ── Generic media item (platform-agnostic minimal shape) ────────

export interface MediaStoreItem {
  id: string;
  title: string;
  imageUrl?: string | null;
  subtitle?: string;
  mediaType?: "image" | "video";
}

// ── Album (platform-agnostic minimal shape) ─────────────────────

export interface MediaStoreAlbum {
  id: string;
  name: string;
  description?: string | null;
  coverImageUrl?: string | null;
  mediaCount?: number;
}

// ── Person tag ──────────────────────────────────────────────────

export interface PersonTag {
  id: string;
  label: string;
}

// ── Semantic search filters ─────────────────────────────────────

export interface SemanticSearchFilters {
  city?: string;
  country?: string;
  peopleDetectedMin?: number;
  peopleDetectedMax?: number;
  ageMin?: number;
  ageMax?: number;
}

export interface SemanticSearchResult extends MediaStoreItem {
  /** RRF or other fused rank score (app-defined). */
  score: number;
  /** Desktop: cosine vs image embedding; optional on web. */
  vlmSimilarity?: number;
  /** Desktop: cosine vs AI caption text embedding; optional on web. */
  descriptionSimilarity?: number;
  city?: string | null;
  country?: string | null;
  peopleDetected?: number | null;
  ageMin?: number | null;
  ageMax?: number | null;
}

// ── Sidebar section identifiers ─────────────────────────────────

export type SidebarSection = "folders" | "albums" | "faceTags" | "settings";

// ── Content view mode ───────────────────────────────────────────

export type ViewMode = "grid" | "list";

// ── Viewer source ───────────────────────────────────────────────

export type ViewerSource = "folder" | "album" | "search" | null;

// ── Metadata scan item (processing-specific) ────────────────────

export type MetadataScanItemAction = "created" | "updated" | "unchanged" | "failed";

export interface MetadataScanItem {
  path: string;
  name: string;
  status: ProcessingItemStatus;
  action?: MetadataScanItemAction;
  mediaItemId?: string | null;
  error?: string;
}

// ── AI analysis item ────────────────────────────────────────────

export interface AiAnalysisItem {
  path: string;
  name: string;
  status: ProcessingItemStatus;
  elapsedSeconds?: number;
  result?: unknown;
  error?: string;
}

// ── Face detection item ─────────────────────────────────────────

export interface FaceDetectionItem {
  path: string;
  name: string;
  status: ProcessingItemStatus;
  elapsedSeconds?: number;
  faceCount?: number;
  result?: unknown;
  error?: string;
}

// ── Semantic index item ──────────────────────────────────────────

export interface SemanticIndexItem {
  path: string;
  name: string;
  status: ProcessingItemStatus;
  elapsedSeconds?: number;
  error?: string;
}

// ── Face detection service status ───────────────────────────────

export interface FaceServiceStatus {
  healthy: boolean;
  running: boolean;
  error?: string | null;
}

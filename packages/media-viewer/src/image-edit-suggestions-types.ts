import type { ReactNode } from "react";

export type ImageEditSuggestionsVariant = "default" | "rotationReview";

export type PriorityLevel = "high" | "medium" | "low" | "unknown";

export interface ImageEditSuggestion {
  editType: string;
  priority?: "high" | "medium" | "low" | null;
  reason?: string | null;
  rotationAngleClockwise?: 90 | 180 | 270 | null;
  cropRel?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

export interface ImageEditSuggestionsItem {
  id: string;
  title: string;
  imageUrl?: string | null;
  folderPathRelative?: string | null;
  suggestions: ImageEditSuggestion[];
}

export interface ImageEditSuggestionsPagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export interface ImageEditSuggestionsViewProps {
  hasFolderSelected: boolean;
  items: ImageEditSuggestionsItem[];
  onBackToPhotos: () => void;
  variant?: ImageEditSuggestionsVariant;
  title?: string;
  noSuggestionsMessage?: string;
  suggestedSummaryLabel?: string;
  highPrioritySummaryLabel?: string;
  applyChangesNote?: string;
  headerExtra?: ReactNode;
  pagination?: ImageEditSuggestionsPagination;
  loading?: boolean;
  error?: string | null;
  onOriginalImageClick?: (item: ImageEditSuggestionsItem) => void;
}

export interface PreviewTransform {
  rotationAngle: 90 | 180 | 270 | null;
  cropBox: { x: number; y: number; width: number; height: number } | null;
  previewSuggestionIndexes: Set<number>;
}

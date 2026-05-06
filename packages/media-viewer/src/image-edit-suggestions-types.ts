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
  sourcePath?: string | null;
  imageUrl?: string | null;
  folderPathRelative?: string | null;
  rotationReviewMeta?: {
    confidence: number | null;
    detectionProcessedAt?: string | null;
  } | null;
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
  folderPathLabel?: string;
  noSuggestionsMessage?: string;
  suggestedSummaryLabel?: string;
  highPrioritySummaryLabel?: string;
  headerExtra?: ReactNode;
  pagination?: ImageEditSuggestionsPagination;
  headerPagination?: ImageEditSuggestionsPagination;
  includeSubfoldersToggle?: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
  };
  onClose?: () => void;
  closeAriaLabel?: string;
  loading?: boolean;
  error?: string | null;
  onOriginalImageClick?: (item: ImageEditSuggestionsItem) => void;
  onRotationSave?: (item: ImageEditSuggestionsItem, selection: RotationReviewSaveSelection) => void;
  onRotationDiscard?: (item: ImageEditSuggestionsItem) => void;
  rotationActionState?: {
    savingItemId?: string | null;
    discardingItemId?: string | null;
    errorByItemId?: Record<string, string | undefined>;
    confirmationByItemId?: Record<
      string,
      { status: "saved" | "discarded"; revision: number } | undefined
    >;
  };
}

export interface PreviewTransform {
  rotationAngle: 90 | 180 | 270 | null;
  cropBox: { x: number; y: number; width: number; height: number } | null;
  previewSuggestionIndexes: Set<number>;
}

export interface RotationReviewSaveSelection {
  rotationAngleClockwise: 90 | 180 | 270;
  cropRel: { x: number; y: number; width: number; height: number } | null;
  flipVertical: boolean;
}

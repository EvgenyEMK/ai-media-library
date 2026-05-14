import type { LucideIcon } from "lucide-react";

/** Catalog decks for tooling (single repo of slide content; different entry points). */
export type GuidedSlideDeckCategory = "product-intro" | "feature-help";

/** One “slide” in a deck: big headline blocks with supporting copy (help wizard or onboarding). */
export interface GuidedContentBlock {
  title: string;
  body: string;
  /** Optional scan-friendly list under the body (e.g. extracted field names). */
  listItems?: readonly string[];
  /**
   * In-modal actions (e.g. open a reference sheet). Parent handles `actionId` via `GuidedSlideModal.onSlideAction`.
   */
  actionLinks?: readonly { label: string; actionId: string }[];
  /** Full URL rendered as a visible link (reliable in browser vs. GitHub blob viewers). */
  externalUrl?: string;
}

export interface GuidedSlideConfig {
  /** Stable id for deep-links or tests (unique within deck). */
  id: string;
  /** Shown under the flow title so users know where they are in the sequence. */
  slideHeadline: string;
  icon: LucideIcon;
  /** Optional icon row (e.g. welcome slide 1). When set, `blocks` may be empty. */
  featureHighlights?: readonly { icon: LucideIcon; label: string; caption?: string }[];
  blocks: readonly GuidedContentBlock[];
}

export interface GuidedSlideDeck {
  /** e.g. feature name — repeated on every slide for orientation in long flows. */
  flowTitle: string;
  slides: readonly GuidedSlideConfig[];
  /** Where this deck is used (global welcome vs in-context feature help). */
  deckCategory?: GuidedSlideDeckCategory;
}

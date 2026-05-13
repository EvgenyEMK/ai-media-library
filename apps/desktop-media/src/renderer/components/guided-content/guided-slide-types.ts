import type { LucideIcon } from "lucide-react";

/** One “slide” in a deck: big headline blocks with supporting copy (help wizard or onboarding). */
export interface GuidedContentBlock {
  title: string;
  body: string;
  /** Optional scan-friendly list under the body (e.g. extracted field names). */
  listItems?: readonly string[];
}

export interface GuidedSlideConfig {
  /** Stable id for deep-links or tests (unique within deck). */
  id: string;
  /** Shown under the flow title so users know where they are in the sequence. */
  slideHeadline: string;
  icon: LucideIcon;
  blocks: readonly GuidedContentBlock[];
}

export interface GuidedSlideDeck {
  /** e.g. feature name — repeated on every slide for orientation in long flows. */
  flowTitle: string;
  slides: readonly GuidedSlideConfig[];
}

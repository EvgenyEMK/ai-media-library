/**
 * Persisted guided help / onboarding overlap (see `AppSettings.guidedExperience`).
 * Topic ids use `domain:feature`; add new union members when a feature ships content.
 * Global first-run welcome uses `productIntro` + `ProductWelcomeDeckVariant` slide decks.
 */
export type GuidedHelpTopicId = "documents:invoices-receipts";

export const GUIDED_HELP_TOPIC_DOCUMENTS_INVOICES_RECEIPTS = "documents:invoices-receipts" satisfies GuidedHelpTopicId;

export const GUIDED_HELP_TOPIC_IDS: readonly GuidedHelpTopicId[] = [GUIDED_HELP_TOPIC_DOCUMENTS_INVOICES_RECEIPTS];

export interface GuidedHelpTopicState {
  /** True after the user closes the help wizard (auto or manual); suppresses future auto-open. */
  helpWizardDismissed: boolean;
  /** ISO timestamp when dismissed (optional diagnostics / future analytics). */
  dismissedAt?: string;
}

/** Welcome wizard deck variants (compare copy density in UI; persisted when completed). */
export type ProductWelcomeDeckVariant = "a" | "b" | "c";

/**
 * Bump when intro gating or mandatory messaging changes so a future build can re-offer
 * the wizard to users who already completed an older schema (not wired yet).
 */
export const CURRENT_PRODUCT_INTRO_SCHEMA_VERSION = 1;

/** Global first-run product welcome (`AppSettings.guidedExperience.productIntro`). */
export interface GuidedProductIntroState {
  completed?: boolean;
  skippedAtStep?: number;
  /** Last completed flow schema; compare to {@link CURRENT_PRODUCT_INTRO_SCHEMA_VERSION} for re-prompts. */
  version?: number;
  dismissedAt?: string;
  /** Deck variant shown when the user finished or dismissed the welcome wizard. */
  lastDeckVariant?: ProductWelcomeDeckVariant;
}

/** Reserved for Phase C — onboarding milestones (shape only; not wired yet). */
export type GuidedMilestonesState = Record<string, unknown>;

export interface GuidedExperienceSettings {
  helpTopics: Partial<Record<GuidedHelpTopicId, GuidedHelpTopicState>>;
  productIntro?: GuidedProductIntroState;
  milestones?: GuidedMilestonesState;
}

export const DEFAULT_GUIDED_EXPERIENCE_SETTINGS: GuidedExperienceSettings = {
  helpTopics: {},
};

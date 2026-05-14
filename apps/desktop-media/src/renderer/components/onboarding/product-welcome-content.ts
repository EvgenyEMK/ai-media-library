import type { ProductWelcomeDeckVariant } from "../../../shared/guided-experience-types";
import type { GuidedSlideDeck } from "../guided-content/guided-slide-types";
import { buildGuidedSlideDeckFromIds, PRODUCT_WELCOME_SLIDE_ORDER } from "./guided-slide-catalog";
import { PRODUCT_WELCOME_SLIDES_VARIANT_B } from "./product-welcome-deck-variant-b";
import { PRODUCT_WELCOME_SLIDES_VARIANT_C } from "./product-welcome-deck-variant-c";

export const PRODUCT_WELCOME_FLOW_TITLE = "Welcome to AI Media Library";

/**
 * Swap to **b** (dense) or **c** (paced) while tuning copy; persisted as `lastDeckVariant` when the user finishes.
 */
export const DEFAULT_PRODUCT_WELCOME_VARIANT: ProductWelcomeDeckVariant = "a";

export function buildProductWelcomeDeck(variant: ProductWelcomeDeckVariant): GuidedSlideDeck {
  if (variant === "a") {
    return buildGuidedSlideDeckFromIds(
      PRODUCT_WELCOME_SLIDE_ORDER,
      "product-welcome",
      PRODUCT_WELCOME_FLOW_TITLE,
      "product-intro",
    );
  }
  const slides = variant === "b" ? PRODUCT_WELCOME_SLIDES_VARIANT_B : PRODUCT_WELCOME_SLIDES_VARIANT_C;
  return {
    flowTitle: PRODUCT_WELCOME_FLOW_TITLE,
    slides,
    deckCategory: "product-intro",
  };
}

export function productWelcomeSlideCount(variant: ProductWelcomeDeckVariant): number {
  return buildProductWelcomeDeck(variant).slides.length;
}

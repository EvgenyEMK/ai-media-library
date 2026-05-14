import type {
  GuidedHelpTopicId,
  ProductWelcomeDeckVariant,
} from "../../shared/guided-experience-types";
import type { DesktopStore } from "../stores/desktop-store";

/** Marks a guided help topic as dismissed (persists via settings auto-save). */
export function markGuidedHelpTopicDismissed(store: DesktopStore, topicId: GuidedHelpTopicId): void {
  store.getState().markGuidedHelpTopicWizardDismissed(topicId);
}

/** Marks the global product welcome as finished (persists via settings auto-save). */
export function markProductIntroDismissed(
  store: DesktopStore,
  deckVariant: ProductWelcomeDeckVariant,
): void {
  store.getState().markProductIntroWizardDismissed(deckVariant);
}

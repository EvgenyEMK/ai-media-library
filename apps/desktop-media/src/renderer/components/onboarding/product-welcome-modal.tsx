import { useCallback, useMemo, useState, type ReactElement } from "react";
import type { ProductWelcomeDeckVariant } from "../../../shared/guided-experience-types";
import { GuidedSlideModal } from "../guided-content";
import { AiModelsReferenceSheet } from "./ai-models-reference-sheet";
import {
  buildProductWelcomeDeck,
  DEFAULT_PRODUCT_WELCOME_VARIANT,
} from "./product-welcome-content";
import {
  handleGuidedSlideDeckAction,
  openOllamaInstallDocInBrowser,
} from "./guided-slide-catalog";

export type { ProductWelcomeDeckVariant } from "../../../shared/guided-experience-types";

export function ProductWelcomeModal({
  open,
  onClose,
  contentVariant = DEFAULT_PRODUCT_WELCOME_VARIANT,
}: {
  open: boolean;
  onClose: () => void;
  contentVariant?: ProductWelcomeDeckVariant;
}): ReactElement | null {
  const deck = useMemo(() => buildProductWelcomeDeck(contentVariant), [contentVariant]);
  const [modelsReferenceOpen, setModelsReferenceOpen] = useState(false);

  const onSlideAction = useCallback((actionId: string): void => {
    const next = handleGuidedSlideDeckAction(actionId);
    if (next === "models") {
      setModelsReferenceOpen(true);
    }
    if (next === "ollama-doc") {
      openOllamaInstallDocInBrowser();
    }
  }, []);

  return (
    <>
      <GuidedSlideModal
        open={open}
        onClose={onClose}
        flowTitle={deck.flowTitle}
        slides={deck.slides}
        initialSlideIndex={0}
        slideHeadlineAsPrimaryExceptFirst
        onSlideAction={onSlideAction}
      />
      <AiModelsReferenceSheet open={modelsReferenceOpen} onClose={() => setModelsReferenceOpen(false)} />
    </>
  );
}

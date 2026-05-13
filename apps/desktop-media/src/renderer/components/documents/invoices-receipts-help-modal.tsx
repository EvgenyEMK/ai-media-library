import { useMemo, type ReactElement } from "react";
import { GuidedSlideModal } from "../guided-content";
import {
  buildInvoicesReceiptsHelpDeck,
  DEFAULT_INVOICES_RECEIPTS_HELP_VARIANT,
  type InvoicesReceiptsHelpVariant,
} from "./invoices-receipts-help-content";

export type { InvoicesReceiptsHelpVariant } from "./invoices-receipts-help-content";

export function InvoicesReceiptsHelpModal({
  open,
  onClose,
  effectivePhotoAnalysisModel,
  contentVariant = DEFAULT_INVOICES_RECEIPTS_HELP_VARIANT,
}: {
  open: boolean;
  onClose: () => void;
  effectivePhotoAnalysisModel: string;
  /** Swap to compare decks: `a` = three steps (default), `b` = three dense steps, `c` = five micro-topics. */
  contentVariant?: InvoicesReceiptsHelpVariant;
}): ReactElement | null {
  const deck = useMemo(
    () => buildInvoicesReceiptsHelpDeck(contentVariant, effectivePhotoAnalysisModel),
    [contentVariant, effectivePhotoAnalysisModel],
  );

  return (
    <GuidedSlideModal
      open={open}
      onClose={onClose}
      flowTitle={deck.flowTitle}
      slides={deck.slides}
      initialSlideIndex={0}
    />
  );
}

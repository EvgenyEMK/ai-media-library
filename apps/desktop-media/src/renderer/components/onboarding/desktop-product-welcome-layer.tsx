import { useCallback, type ReactElement } from "react";
import { useProductWelcomeAutoOpen } from "../../hooks/use-product-welcome-auto-open";
import { useDesktopStore } from "../../stores/desktop-store";
import { DEFAULT_PRODUCT_WELCOME_VARIANT } from "./product-welcome-content";
import { ProductWelcomeModal } from "./product-welcome-modal";

/**
 * Global first-run welcome (short product intro). Feature-specific decks (e.g. People (?)) stay separate.
 * Change {@link DEFAULT_PRODUCT_WELCOME_VARIANT} in `product-welcome-content.ts` to compare decks **a** / **b** / **c**.
 */
export function DesktopProductWelcomeLayer(): ReactElement | null {
  const deckVariant = DEFAULT_PRODUCT_WELCOME_VARIANT;
  const previewOpen = useDesktopStore((s) => s.productWelcomePreviewOpen);
  const setProductWelcomePreviewOpen = useDesktopStore((s) => s.setProductWelcomePreviewOpen);
  const { open: autoOpen, onAutoClose } = useProductWelcomeAutoOpen(deckVariant);

  const showModal = autoOpen || previewOpen;

  const onClose = useCallback((): void => {
    setProductWelcomePreviewOpen(false);
    if (autoOpen) {
      onAutoClose();
    }
  }, [autoOpen, onAutoClose, setProductWelcomePreviewOpen]);

  return <ProductWelcomeModal open={showModal} onClose={onClose} contentVariant={deckVariant} />;
}

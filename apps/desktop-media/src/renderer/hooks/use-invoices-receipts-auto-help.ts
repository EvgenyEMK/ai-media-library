import { useEffect, useRef } from "react";
import { GUIDED_HELP_TOPIC_DOCUMENTS_INVOICES_RECEIPTS } from "../../shared/guided-experience-types";
import { useDesktopStore } from "../stores/desktop-store";

/**
 * Opens the Invoices & Receipts help wizard once after settings hydration if the user
 * has not yet dismissed that topic (first visit / skipped global onboarding).
 */
export function useInvoicesReceiptsAutoHelp(setHelpOpen: (open: boolean) => void): void {
  const persistedSettingsHydrated = useDesktopStore((s) => s.persistedSettingsHydrated);
  const dismissed =
    useDesktopStore(
      (s) =>
        s.guidedExperienceSettings.helpTopics[GUIDED_HELP_TOPIC_DOCUMENTS_INVOICES_RECEIPTS]
          ?.helpWizardDismissed === true,
    );
  const autoOpenAttemptedRef = useRef(false);

  useEffect(() => {
    if (!persistedSettingsHydrated) {
      return;
    }
    if (dismissed) {
      return;
    }
    if (autoOpenAttemptedRef.current) {
      return;
    }
    autoOpenAttemptedRef.current = true;
    setHelpOpen(true);
  }, [persistedSettingsHydrated, dismissed, setHelpOpen]);
}

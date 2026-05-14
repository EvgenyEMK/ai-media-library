import { useCallback, useEffect, useState } from "react";
import type { ProductWelcomeDeckVariant } from "../../shared/guided-experience-types";
import { markProductIntroDismissed } from "../actions/guided-experience-actions";
import { useDesktopStore, useDesktopStoreApi } from "../stores/desktop-store";

/**
 * Opens the first-run welcome wizard after settings hydration when `productIntro` is not completed,
 * unless `getDesktopRuntimeFlags().skipAutoProductIntro` is true (Playwright).
 *
 * Waits for runtime flags **after** hydration so we never gate on a null "skip" flag (race with first paint).
 */
export function useProductWelcomeAutoOpen(deckVariant: ProductWelcomeDeckVariant): {
  open: boolean;
  onAutoClose: () => void;
} {
  const [open, setOpen] = useState(false);
  const storeApi = useDesktopStoreApi();
  const persistedSettingsHydrated = useDesktopStore((s) => s.persistedSettingsHydrated);
  const introCompleted = useDesktopStore((s) => s.guidedExperienceSettings.productIntro?.completed === true);

  useEffect(() => {
    if (introCompleted) {
      setOpen(false);
    }
  }, [introCompleted]);

  useEffect(() => {
    if (!persistedSettingsHydrated) {
      return;
    }
    if (introCompleted) {
      return;
    }
    let cancelled = false;
    let rafId: number | null = null;
    const scheduleOpen = (): void => {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (!cancelled) {
          setOpen(true);
        }
      });
    };
    void window.desktopApi
      .getDesktopRuntimeFlags()
      .then((flags) => {
        if (cancelled) {
          return;
        }
        if (flags.skipAutoProductIntro) {
          return;
        }
        scheduleOpen();
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        scheduleOpen();
      });
    return () => {
      cancelled = true;
      if (rafId != null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [persistedSettingsHydrated, introCompleted]);

  const onAutoClose = useCallback((): void => {
    markProductIntroDismissed(storeApi, deckVariant);
    setOpen(false);
  }, [storeApi, deckVariant]);

  return { open, onAutoClose };
}

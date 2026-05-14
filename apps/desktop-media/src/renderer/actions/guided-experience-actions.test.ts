import { describe, expect, it, vi } from "vitest";
import { markGuidedHelpTopicDismissed, markProductIntroDismissed } from "./guided-experience-actions";
import { createDesktopStore } from "../stores/desktop-store";
import {
  CURRENT_PRODUCT_INTRO_SCHEMA_VERSION,
  GUIDED_HELP_TOPIC_DOCUMENTS_INVOICES_RECEIPTS,
} from "../../shared/guided-experience-types";

describe("markGuidedHelpTopicDismissed", () => {
  it("sets helpWizardDismissed for the topic", () => {
    const store = createDesktopStore();
    markGuidedHelpTopicDismissed(store, GUIDED_HELP_TOPIC_DOCUMENTS_INVOICES_RECEIPTS);
    expect(
      store.getState().guidedExperienceSettings.helpTopics[GUIDED_HELP_TOPIC_DOCUMENTS_INVOICES_RECEIPTS]
        ?.helpWizardDismissed,
    ).toBe(true);
    expect(
      store.getState().guidedExperienceSettings.helpTopics[GUIDED_HELP_TOPIC_DOCUMENTS_INVOICES_RECEIPTS]
        ?.dismissedAt,
    ).toEqual(expect.any(String));
  });

  it("is idempotent when already dismissed", () => {
    const store = createDesktopStore();
    const spy = vi.spyOn(store, "setState");
    markGuidedHelpTopicDismissed(store, GUIDED_HELP_TOPIC_DOCUMENTS_INVOICES_RECEIPTS);
    const first =
      store.getState().guidedExperienceSettings.helpTopics[GUIDED_HELP_TOPIC_DOCUMENTS_INVOICES_RECEIPTS]
        ?.dismissedAt;
    markGuidedHelpTopicDismissed(store, GUIDED_HELP_TOPIC_DOCUMENTS_INVOICES_RECEIPTS);
    const second =
      store.getState().guidedExperienceSettings.helpTopics[GUIDED_HELP_TOPIC_DOCUMENTS_INVOICES_RECEIPTS]
        ?.dismissedAt;
    expect(first).toBe(second);
    spy.mockRestore();
  });
});

describe("markProductIntroDismissed", () => {
  it("sets completed, schema version, dismissedAt, and lastDeckVariant", () => {
    const store = createDesktopStore();
    markProductIntroDismissed(store, "b");
    const intro = store.getState().guidedExperienceSettings.productIntro;
    expect(intro?.completed).toBe(true);
    expect(intro?.version).toBe(CURRENT_PRODUCT_INTRO_SCHEMA_VERSION);
    expect(intro?.lastDeckVariant).toBe("b");
    expect(intro?.dismissedAt).toEqual(expect.any(String));
  });

  it("is idempotent when already completed", () => {
    const store = createDesktopStore();
    const spy = vi.spyOn(store, "setState");
    markProductIntroDismissed(store, "a");
    const first = store.getState().guidedExperienceSettings.productIntro?.dismissedAt;
    markProductIntroDismissed(store, "c");
    const second = store.getState().guidedExperienceSettings.productIntro?.dismissedAt;
    expect(first).toBe(second);
    expect(store.getState().guidedExperienceSettings.productIntro?.lastDeckVariant).toBe("a");
    spy.mockRestore();
  });
});

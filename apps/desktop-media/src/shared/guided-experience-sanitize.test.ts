import { describe, expect, it } from "vitest";
import { isGuidedHelpTopicId, sanitizeGuidedExperienceSettings } from "./guided-experience-sanitize";
import { DEFAULT_GUIDED_EXPERIENCE_SETTINGS } from "./guided-experience-types";

describe("isGuidedHelpTopicId", () => {
  it("accepts registered topic ids", () => {
    expect(isGuidedHelpTopicId("documents:invoices-receipts")).toBe(true);
  });

  it("rejects unknown ids", () => {
    expect(isGuidedHelpTopicId("people:overview")).toBe(false);
    expect(isGuidedHelpTopicId("")).toBe(false);
  });
});

describe("sanitizeGuidedExperienceSettings", () => {
  it("returns defaults for non-object input", () => {
    expect(sanitizeGuidedExperienceSettings(null)).toEqual(DEFAULT_GUIDED_EXPERIENCE_SETTINGS);
    expect(sanitizeGuidedExperienceSettings(undefined)).toEqual(DEFAULT_GUIDED_EXPERIENCE_SETTINGS);
    expect(sanitizeGuidedExperienceSettings("x")).toEqual(DEFAULT_GUIDED_EXPERIENCE_SETTINGS);
  });

  it("requires boolean helpWizardDismissed on topic entries", () => {
    const out = sanitizeGuidedExperienceSettings({
      helpTopics: {
        "documents:invoices-receipts": { helpWizardDismissed: "yes" },
      },
    });
    expect(out.helpTopics["documents:invoices-receipts"]).toBeUndefined();
  });

  it("keeps valid topic state and optional dismissedAt", () => {
    const out = sanitizeGuidedExperienceSettings({
      helpTopics: {
        "documents:invoices-receipts": {
          helpWizardDismissed: true,
          dismissedAt: "2026-05-01T12:00:00.000Z",
        },
      },
    });
    expect(out.helpTopics["documents:invoices-receipts"]).toEqual({
      helpWizardDismissed: true,
      dismissedAt: "2026-05-01T12:00:00.000Z",
    });
  });

  it("sanitizes productIntro numeric fields", () => {
    const out = sanitizeGuidedExperienceSettings({
      productIntro: { skippedAtStep: 2.7, version: 1.2, completed: true },
    });
    expect(out.productIntro).toEqual({
      completed: true,
      skippedAtStep: 2,
      version: 1,
    });
  });

  it("keeps productIntro dismissedAt and lastDeckVariant when valid", () => {
    const out = sanitizeGuidedExperienceSettings({
      productIntro: {
        completed: true,
        version: 1,
        dismissedAt: "2026-05-01T12:00:00.000Z",
        lastDeckVariant: "c",
      },
    });
    expect(out.productIntro).toEqual({
      completed: true,
      version: 1,
      dismissedAt: "2026-05-01T12:00:00.000Z",
      lastDeckVariant: "c",
    });
  });

  it("drops invalid productIntro lastDeckVariant", () => {
    const out = sanitizeGuidedExperienceSettings({
      productIntro: { completed: true, lastDeckVariant: "x" },
    });
    expect(out.productIntro?.lastDeckVariant).toBeUndefined();
  });
});

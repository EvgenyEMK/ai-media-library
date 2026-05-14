import {
  DEFAULT_GUIDED_EXPERIENCE_SETTINGS,
  GUIDED_HELP_TOPIC_IDS,
  type GuidedExperienceSettings,
  type GuidedHelpTopicId,
  type GuidedHelpTopicState,
} from "./guided-experience-types";

const topicIdSet = new Set<string>(GUIDED_HELP_TOPIC_IDS);

export function isGuidedHelpTopicId(value: string): value is GuidedHelpTopicId {
  return topicIdSet.has(value);
}

function sanitizeTopicState(candidate: unknown): GuidedHelpTopicState | undefined {
  if (candidate === null || candidate === undefined || typeof candidate !== "object") {
    return undefined;
  }
  const o = candidate as Record<string, unknown>;
  if (typeof o.helpWizardDismissed !== "boolean") {
    return undefined;
  }
  const dismissedAt =
    typeof o.dismissedAt === "string" && o.dismissedAt.length > 0 ? o.dismissedAt : undefined;
  if (dismissedAt !== undefined) {
    return { helpWizardDismissed: o.helpWizardDismissed, dismissedAt };
  }
  return { helpWizardDismissed: o.helpWizardDismissed };
}

export function sanitizeGuidedExperienceSettings(candidate: unknown): GuidedExperienceSettings {
  const helpTopics: Partial<Record<GuidedHelpTopicId, GuidedHelpTopicState>> = {};
  if (candidate === null || candidate === undefined || typeof candidate !== "object") {
    return { ...DEFAULT_GUIDED_EXPERIENCE_SETTINGS, helpTopics };
  }
  const raw = candidate as Record<string, unknown>;
  const helpTopicsRaw = raw.helpTopics;
  if (
    helpTopicsRaw !== null &&
    helpTopicsRaw !== undefined &&
    typeof helpTopicsRaw === "object" &&
    !Array.isArray(helpTopicsRaw)
  ) {
    for (const key of Object.keys(helpTopicsRaw)) {
      if (!isGuidedHelpTopicId(key)) {
        continue;
      }
      const state = sanitizeTopicState((helpTopicsRaw as Record<string, unknown>)[key]);
      if (state) {
        helpTopics[key] = state;
      }
    }
  }

  const next: GuidedExperienceSettings = {
    ...DEFAULT_GUIDED_EXPERIENCE_SETTINGS,
    helpTopics,
  };

  if (
    raw.productIntro !== null &&
    raw.productIntro !== undefined &&
    typeof raw.productIntro === "object" &&
    !Array.isArray(raw.productIntro)
  ) {
    const pi = raw.productIntro as Record<string, unknown>;
    const dismissedAt =
      typeof pi.dismissedAt === "string" && pi.dismissedAt.length > 0 ? pi.dismissedAt : undefined;
    const lastDeckVariant =
      pi.lastDeckVariant === "a" || pi.lastDeckVariant === "b" || pi.lastDeckVariant === "c"
        ? pi.lastDeckVariant
        : undefined;
    next.productIntro = {
      completed: typeof pi.completed === "boolean" ? pi.completed : undefined,
      skippedAtStep:
        typeof pi.skippedAtStep === "number" && Number.isFinite(pi.skippedAtStep)
          ? Math.trunc(pi.skippedAtStep)
          : undefined,
      version:
        typeof pi.version === "number" && Number.isFinite(pi.version) ? Math.trunc(pi.version) : undefined,
      dismissedAt,
      lastDeckVariant,
    };
  }

  if (
    raw.milestones !== null &&
    raw.milestones !== undefined &&
    typeof raw.milestones === "object" &&
    !Array.isArray(raw.milestones)
  ) {
    next.milestones = { ...(raw.milestones as Record<string, unknown>) };
  }

  return next;
}

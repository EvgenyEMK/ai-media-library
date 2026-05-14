# Onboarding and in-app guided help

This roadmap covers **first-run product onboarding**, **per-feature help wizards** (`GuidedSlideModal`), and **progress / milestone** tracking. Implementation is phased so we can ship incrementally.

## Goals

1. **In-app help (contextual)** — Users open a feature-specific slide deck from `(?)` icons; some decks may also **auto-open once** the first time the user enters a feature, then never again unless opened manually.
2. **Product onboarding** — Optional global intro (values, first steps) on first launch, with persistence for completed / skipped steps.
3. **Milestone-style onboarding** — Track meaningful actions (for example face detection coverage, People tags) to nudge or unlock later guidance.
4. **Reuse slide content** — Same `GuidedSlideDeck` builders and `GuidedSlideModal` for both contextual help and onboarding subsets (pick slides by `id` or index ranges).

## Topic identifiers

Persisted state keys use **`domain:feature`** strings. Known ids are typed as `GuidedHelpTopicId` in [`apps/desktop-media/src/shared/guided-experience-types.ts`](../apps/desktop-media/src/shared/guided-experience-types.ts). Add new union members when a feature’s content is ready (do not pre-register unused topics).

Examples (future): `people:overview`, `people:face-tags`, `albums:smart`, `ai:face-detection`, `ai:image-analysis`, `metadata:geo`.

## Persistence

`AppSettings.guidedExperience` in [`apps/desktop-media/src/shared/ipc.ts`](../apps/desktop-media/src/shared/ipc.ts) holds:

- **`helpTopics`** — Per-topic `helpWizardDismissed` (+ optional `dismissedAt`). Dismissal applies after any close path (auto-open, manual `(?)`, incomplete deck) so auto-open does not repeat.
- **`productIntro`** (reserved) — Planned: global intro deck version, last step, completed / skipped.
- **`milestones`** (reserved) — Planned: opaque map or structured flags for “has run face detection on N images”, etc.

Sanitization on read: [`apps/desktop-media/src/shared/guided-experience-sanitize.ts`](../apps/desktop-media/src/shared/guided-experience-sanitize.ts). The renderer mirrors into Zustand and auto-persists with other settings.

**Hydration:** `persistedSettingsHydrated` in the desktop store is set when settings are applied from disk so feature screens do not auto-open help before the first `getSettings` completes.

## Phase table

| Phase | Scope | Status |
| ----- | ----- | ------ |
| **A** | Per-topic auto-open + dismissal for **Invoices & Receipts** (`documents:invoices-receipts`); shared types, storage sanitize, Zustand + `saveSettings` wiring | In progress / baseline |
| **B** | Global first-run intro slides; subset selection from existing decks (`pickSlidesById` or documented index ranges); `productIntro` persistence | Planned |
| **C** | Milestone queries + UI nudges; extend `milestones` (or dedicated shape) | Planned |

## Interaction rules

- **Manual `(?)`** — Unchanged; always opens the same modal.
- **Auto-open** — Runs at most once per topic until the user dismisses the modal (any close = dismissed for auto purposes).
- **Onboarding vs contextual** — Later: global intro may run first; per-feature auto-open can respect `productIntro` completion flags when product copy defines the rule.

## Related code

- Slide UI: [`apps/desktop-media/src/renderer/components/guided-content/`](../apps/desktop-media/src/renderer/components/guided-content/)
- Example deck: [`apps/desktop-media/src/renderer/components/documents/invoices-receipts-help-content.ts`](../apps/desktop-media/src/renderer/components/documents/invoices-receipts-help-content.ts)
- Automatable dismiss action: [`apps/desktop-media/src/renderer/actions/guided-experience-actions.ts`](../apps/desktop-media/src/renderer/actions/guided-experience-actions.ts)

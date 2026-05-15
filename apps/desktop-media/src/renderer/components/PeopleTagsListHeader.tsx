import { type ReactElement, useCallback, useMemo, useState } from "react";
import { HelpCircle, Loader2, RefreshCw, UserPlus } from "lucide-react";
import { GuidedSlideModal } from "./guided-content/guided-slide-modal";
import { AiModelsReferenceSheet } from "./onboarding/ai-models-reference-sheet";
import {
  buildGuidedSlideDeckFromIds,
  handleGuidedSlideDeckAction,
  openOllamaInstallDocInBrowser,
  PEOPLE_FACES_HELP_SLIDE_ORDER,
} from "./onboarding/guided-slide-catalog";

const UI_TEXT = {
  title: "People",
  helpAria: "People & faces overview",
  addPersonAria: "Add person",
  refreshAriaLabel:
    "Refresh people list and recompute similar face counts for the current page",
} as const;

export function PeopleTagsListHeader({
  isLoading,
  onRefresh,
  onAddPerson,
}: {
  isLoading: boolean;
  onRefresh: () => void;
  onAddPerson: () => void;
}): ReactElement {
  const [peopleGuideOpen, setPeopleGuideOpen] = useState(false);
  const [modelsReferenceOpen, setModelsReferenceOpen] = useState(false);

  const peopleHelpDeck = useMemo(
    () =>
      buildGuidedSlideDeckFromIds(
        PEOPLE_FACES_HELP_SLIDE_ORDER,
        "people-faces-help",
        "People",
        "feature-help",
      ),
    [],
  );

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
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-wrap items-start gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-3xl font-bold md:text-4xl">{UI_TEXT.title}</h1>
              <button
                type="button"
                onClick={() => {
                  setPeopleGuideOpen(true);
                }}
                className="inline-flex size-[33px] shrink-0 items-center justify-center rounded-full border border-border p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={UI_TEXT.helpAria}
                title={UI_TEXT.helpAria}
              >
                <HelpCircle className="size-[29px]" aria-hidden />
              </button>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 md:pt-1">
          <button
            type="button"
            onClick={onAddPerson}
            className="inline-flex size-10 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={UI_TEXT.addPersonAria}
            title={UI_TEXT.addPersonAria}
          >
            <UserPlus className="size-8" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => void onRefresh()}
            disabled={isLoading}
            title={UI_TEXT.refreshAriaLabel}
            aria-label={UI_TEXT.refreshAriaLabel}
            className="inline-flex size-10 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="size-8 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-8" aria-hidden />
            )}
          </button>
        </div>
      </header>

      <GuidedSlideModal
        open={peopleGuideOpen}
        onClose={() => setPeopleGuideOpen(false)}
        flowTitle={peopleHelpDeck.flowTitle}
        slides={peopleHelpDeck.slides}
        initialSlideIndex={0}
        slideHeadlineAsPrimaryExceptFirst
        onSlideAction={onSlideAction}
      />
      <AiModelsReferenceSheet open={modelsReferenceOpen} onClose={() => setModelsReferenceOpen(false)} />
    </>
  );
}

import { type ReactElement, useState } from "react";
import { HelpCircle, Loader2, RefreshCw, UserPlus } from "lucide-react";
import { PeopleOnboardingModal, type PeopleOnboardingSlideId } from "./PeopleOnboardingModal";

const UI_TEXT = {
  title: "People",
  helpAria: "About People tags and birth dates",
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
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingSlideId, setOnboardingSlideId] = useState<PeopleOnboardingSlideId>("whyTags");

  return (
    <>
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-wrap items-start gap-2">
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-bold md:text-4xl">{UI_TEXT.title}</h1>
            <button
              type="button"
              onClick={() => {
                setOnboardingSlideId("whyTags");
                setOnboardingOpen(true);
              }}
              className="inline-flex size-[33px] shrink-0 items-center justify-center rounded-full border border-border p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={UI_TEXT.helpAria}
              title={UI_TEXT.helpAria}
            >
              <HelpCircle className="size-[29px]" aria-hidden />
            </button>
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

      <PeopleOnboardingModal
        open={onboardingOpen}
        initialSlideId={onboardingSlideId}
        onClose={() => setOnboardingOpen(false)}
      />
    </>
  );
}

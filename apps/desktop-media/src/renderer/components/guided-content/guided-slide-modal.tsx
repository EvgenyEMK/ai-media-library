import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import type { GuidedSlideConfig } from "./guided-slide-types";
import { GuidedContentBlockView } from "./guided-content-block";

export function GuidedSlideModal({
  open,
  onClose,
  flowTitle,
  slides,
  initialSlideIndex = 0,
  /**
   * When true: slide 0 keeps `flowTitle` as the large heading and `slideHeadline` as the smaller line;
   * slides 1+ swap so `slideHeadline` is large and `flowTitle` is the smaller line (product welcome).
   */
  slideHeadlineAsPrimaryExceptFirst = false,
  onSlideAction,
}: {
  open: boolean;
  onClose: () => void;
  flowTitle: string;
  slides: readonly GuidedSlideConfig[];
  initialSlideIndex?: number;
  slideHeadlineAsPrimaryExceptFirst?: boolean;
  /** In-slide buttons (e.g. open reference sheet); parent interprets `actionId`. */
  onSlideAction?: (actionId: string) => void;
}): ReactElement | null {
  const safeInitial = useMemo(() => {
    if (slides.length === 0) return 0;
    return Math.min(Math.max(0, initialSlideIndex), slides.length - 1);
  }, [initialSlideIndex, slides.length]);

  const [index, setIndex] = useState(safeInitial);

  useEffect(() => {
    if (open) setIndex(safeInitial);
  }, [open, safeInitial]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(0, current - 1));
      if (event.key === "ArrowRight") setIndex((current) => Math.min(slides.length - 1, current + 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, slides.length]);

  if (!open || slides.length === 0) return null;

  const slide = slides[index] ?? slides[0];
  const Icon = slide.icon;

  const useSlideHeadlinePrimary = slideHeadlineAsPrimaryExceptFirst === true && index > 0;
  const slideHeadlineTrimmed = slide.slideHeadline.trim();
  const primaryHeading = useSlideHeadlinePrimary
    ? slideHeadlineTrimmed.length > 0
      ? slide.slideHeadline
      : flowTitle
    : flowTitle;
  const secondaryHeading = useSlideHeadlinePrimary
    ? slideHeadlineTrimmed.length > 0
      ? flowTitle
      : null
    : slide.slideHeadline.trim().length > 0
      ? slide.slideHeadline
      : null;

  const highlights = slide.featureHighlights ?? [];

  /** Matches `Icon` size so body copy lines up with the heading text column. */
  const iconRailClass = "flex w-[76px] shrink-0 justify-center";

  const headerAlignClass = secondaryHeading == null ? "items-center" : "items-start";
  /** Match header `pr-12` (close button) so body + footer align with title text from slide 2 onward. */
  const contentRightInsetClass = index > 0 ? "pr-12" : "";

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-5 backdrop-blur-sm">
      <div className="relative flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border-2 border-primary/70 bg-background shadow-2xl">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_85%_at_0%_0%,hsl(var(--primary)/0.16),transparent_58%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_85%_at_100%_100%,hsl(var(--primary)/0.14),transparent_58%)]"
          aria-hidden
        />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className="relative shrink-0 border-b border-primary/25 px-6 pb-4 pt-4 md:px-10">
            <button
              type="button"
              className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-secondary p-0 text-muted-foreground shadow-none hover:text-foreground"
              aria-label="Close guide"
              onClick={onClose}
            >
              <X size={18} aria-hidden="true" />
            </button>
            <div className={`mx-auto flex w-full max-w-5xl gap-3 pr-12 ${headerAlignClass}`}>
              <div className={`${iconRailClass} ${secondaryHeading == null ? "self-center pt-0" : "pt-1"}`}>
                <Icon size={76} className="shrink-0 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 line-clamp-3 break-words text-3xl font-semibold leading-snug text-foreground md:text-4xl md:leading-snug">
                  {primaryHeading}
                </h3>
                {secondaryHeading ? (
                  <p className="m-0 mt-1.5 line-clamp-3 break-words text-base font-medium leading-snug text-muted-foreground md:text-lg md:leading-snug">
                    {secondaryHeading}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 md:px-10">
              <div
                className={`mx-auto flex min-h-[min(100%,72vh)] w-full max-w-5xl flex-col justify-evenly gap-10 py-10 md:gap-14 md:py-12 ${contentRightInsetClass}`}
              >
                {highlights.length > 0 ? (
                  <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
                    {highlights.map((row, hi) => {
                      const RowIcon = row.icon;
                      return (
                        <div
                          key={`${row.label}-${hi}`}
                          className="flex flex-col items-center gap-2 rounded-lg border border-border/80 bg-muted/35 px-3 py-5 text-center md:gap-2.5 md:py-7"
                        >
                          <RowIcon className="size-10 shrink-0 text-primary md:size-12" aria-hidden />
                          <span className="text-base font-semibold leading-snug text-foreground md:text-lg">
                            {row.label}
                          </span>
                          {row.caption != null && row.caption.trim().length > 0 ? (
                            <span className="text-xs leading-snug text-muted-foreground md:text-sm">
                              {row.caption}
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                {slide.blocks.length > 0 ? (
                  <div className="flex w-full gap-3">
                    <div className={iconRailClass} aria-hidden="true" />
                    <div className="flex min-w-0 flex-1 flex-col gap-10 md:gap-14">
                      {slide.blocks.map((block, blockIndex) => (
                        <GuidedContentBlockView
                          key={`${slide.id}-${blockIndex}`}
                          {...block}
                          onActionLink={onSlideAction}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="relative z-10 shrink-0 border-t border-primary/25 bg-background px-6 py-4 md:px-10">
            <div className={`mx-auto flex w-full max-w-5xl gap-3 ${contentRightInsetClass}`}>
              <div className={iconRailClass} aria-hidden="true" />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <div className="min-w-[94px]">
                  {index > 0 ? (
                    <button
                      type="button"
                      className="m-0 inline-flex h-9 items-center gap-2 rounded-md border border-input bg-secondary px-3 text-sm text-foreground shadow-none"
                      onClick={() => setIndex((current) => Math.max(0, current - 1))}
                    >
                      <ChevronLeft size={16} aria-hidden="true" />
                      Previous
                    </button>
                  ) : null}
                </div>
                <div className="text-sm font-semibold text-muted-foreground">
                  {index + 1} / {slides.length}
                </div>
                <div className="min-w-[72px] text-right">
                  {index < slides.length - 1 ? (
                    <button
                      type="button"
                      className="m-0 inline-flex h-9 items-center gap-2 rounded-md border border-input bg-secondary px-3 text-sm text-foreground shadow-none"
                      onClick={() => setIndex((current) => Math.min(slides.length - 1, current + 1))}
                    >
                      Next
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

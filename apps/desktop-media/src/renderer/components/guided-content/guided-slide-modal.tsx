import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import type { GuidedSlideConfig } from "./guided-slide-types";
import { GuidedContentBlockView } from "./guided-content-block";

export function GuidedSlideModal({
  open,
  onClose,
  flowTitle,
  slides,
  initialSlideIndex = 0,
}: {
  open: boolean;
  onClose: () => void;
  flowTitle: string;
  slides: readonly GuidedSlideConfig[];
  initialSlideIndex?: number;
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-5 backdrop-blur-sm">
      <div className="relative flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <Icon size={76} className="shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <h3 className="m-0 truncate text-3xl font-semibold leading-tight text-foreground md:text-4xl">
                {flowTitle}
              </h3>
              {slide.slideHeadline ? (
                <p className="m-0 mt-1.5 text-base font-medium leading-snug text-muted-foreground md:text-lg">
                  {slide.slideHeadline}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-secondary/70 p-0 text-muted-foreground shadow-none hover:text-foreground"
            aria-label="Close guide"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="mx-auto flex min-h-[min(100%,70vh)] w-full max-w-4xl flex-col justify-evenly gap-12 px-6 py-10 md:gap-16 md:px-10 md:py-14">
              {slide.blocks.map((block, blockIndex) => (
                <GuidedContentBlockView key={`${slide.id}-${block.title}-${blockIndex}`} {...block} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-4">
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
  );
}

import { CheckCircle2, ChevronLeft, ChevronRight, ListChecks, MapPin, RotateCw, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { cn } from "../../lib/cn";

export type PipelineOnboardingSlideId = "face" | "geo" | "rotation" | "folderScan";

interface PipelineOnboardingBullet {
  text: string;
  icon?: LucideIcon;
}

interface PipelineOnboardingSlide {
  id: PipelineOnboardingSlideId;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  bullets: PipelineOnboardingBullet[];
  renderContent?: () => ReactElement;
}

const SLIDES: PipelineOnboardingSlide[] = [
  {
    id: "folderScan",
    title: "Folder tree scan",
    subtitle: "Track scan freshness and detect folders that still need scanning",
    icon: ListChecks,
    bullets: [
      { text: "Shows not scanned sub-folders first so you can prioritize updates.", icon: CheckCircle2 },
      { text: "Highlights oldest scan and latest data-change timestamps.", icon: CheckCircle2 },
      { text: "Launches folder tree scan directly from the summary card.", icon: CheckCircle2 },
    ],
  },
  {
    id: "face",
    title: "Face detection",
    subtitle: "Find people in your library automatically",
    icon: Users,
    bullets: [
      { text: "Detects faces in images and prepares people suggestions.", icon: CheckCircle2 },
      { text: "Lets you review clusters faster from the Face tab.", icon: CheckCircle2 },
      { text: "Can be re-run for new files after a folder scan.", icon: CheckCircle2 },
    ],
  },
  {
    id: "geo",
    title: "Geo-location",
    subtitle: "Turn GPS metadata into searchable location details",
    icon: MapPin,
    bullets: [
      { text: "Tracks how many files already contain GPS coordinates.", icon: CheckCircle2 },
      { text: "Extracts city/region/country details from available GPS data.", icon: CheckCircle2 },
      { text: "Helps identify folders where location coverage is still low.", icon: CheckCircle2 },
    ],
  },
  {
    id: "rotation",
    title: "Wrongly rotated images",
    subtitle: "Spot orientation issues before editing or sharing",
    icon: RotateCw,
    bullets: [
      { text: "Checks image orientation metadata and detects likely rotation mistakes.", icon: CheckCircle2 },
      { text: "Highlights files that need manual correction.", icon: CheckCircle2 },
      { text: "Keeps your gallery and exported albums visually consistent.", icon: CheckCircle2 },
    ],
  },
];

export function PipelineOnboardingModal({
  open,
  initialSlideId,
  onClose,
}: {
  open: boolean;
  initialSlideId: PipelineOnboardingSlideId;
  onClose: () => void;
}): ReactElement | null {
  const initialIndex = useMemo(() => Math.max(0, SLIDES.findIndex((slide) => slide.id === initialSlideId)), [initialSlideId]);
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") setIndex((current) => Math.max(0, current - 1));
      if (event.key === "ArrowRight") setIndex((current) => Math.min(SLIDES.length - 1, current + 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const slide = SLIDES[index] ?? SLIDES[0];
  const Icon = slide.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-5 backdrop-blur-sm">
      <div className="relative flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <Icon size={76} className="shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <h3 className="m-0 truncate text-4xl font-semibold leading-tight text-foreground">{slide.title}</h3>
              {slide.subtitle ? <p className="m-0 mt-1 text-lg text-muted-foreground">{slide.subtitle}</p> : null}
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-secondary/70 p-0 text-muted-foreground shadow-none hover:text-foreground"
            aria-label="Close guide"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="rounded-xl border border-border bg-card p-6">
            {slide.renderContent ? (
              slide.renderContent()
            ) : (
              <>
                <h4 className="m-0 text-2xl font-semibold text-foreground">What this pipeline helps with</h4>
                <div className="mt-5 grid gap-3">
                  {slide.bullets.map((bullet) => {
                    const BulletIcon = bullet.icon;
                    return (
                      <div key={bullet.text} className="flex items-start gap-3 rounded-lg border border-border/60 bg-secondary/30 px-3 py-3">
                        {BulletIcon ? <BulletIcon size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" /> : null}
                        <p className={cn("m-0 text-lg leading-relaxed text-foreground", BulletIcon ? "" : "pl-[30px]")}>
                          {bullet.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-4">
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
            {index + 1} / {SLIDES.length}
          </div>
          <div className="min-w-[72px] text-right">
            {index < SLIDES.length - 1 ? (
              <button
                type="button"
                className="m-0 inline-flex h-9 items-center gap-2 rounded-md border border-input bg-secondary px-3 text-sm text-foreground shadow-none"
                onClick={() => setIndex((current) => Math.min(SLIDES.length - 1, current + 1))}
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

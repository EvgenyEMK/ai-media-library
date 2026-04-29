import { Eye, ScanFace, Tags, UserRoundCheck, Users } from "lucide-react";
import { useMemo, useState, type ReactElement } from "react";
import type { FolderFaceSummary } from "../../../shared/ipc";
import { formatCoveragePercent, formatGroupedInt } from "../../lib/folder-ai-summary-formatters";
import { UI_TEXT } from "../../lib/ui-text";
import { cn } from "../../lib/cn";

type Variant = "a" | "b" | "c";
type DetailKey = "coverage" | "outcomes" | "tagging" | "ageGender" | "subjects" | "topTags";

interface FaceMetric {
  label: string;
  value: string;
  tone?: "default" | "warning" | "muted";
}

function FaceMetricTile({ label, value, tone = "default" }: FaceMetric): ReactElement {
  return (
    <div className="rounded-md border border-border/60 bg-background/50 px-2.5 py-2">
      <p className="m-0 text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "m-0 mt-1 text-lg font-semibold",
          tone === "warning" ? "text-warning" : tone === "muted" ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FaceInsightCard({
  icon,
  title,
  metrics,
  onViewDetails,
}: {
  icon: ReactElement;
  title: string;
  metrics: FaceMetric[];
  onViewDetails?: () => void;
}): ReactElement {
  return (
    <section className="min-w-[360px] flex-1 rounded-xl border border-border bg-primary/5 p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-foreground">
          {icon}
          <h3 className="m-0 text-lg font-semibold">{title}</h3>
        </div>
        {onViewDetails ? (
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-secondary p-0 shadow-none"
            onClick={onViewDetails}
            aria-label={UI_TEXT.folderFaceSummaryViewDetails}
            title={UI_TEXT.folderFaceSummaryViewDetails}
          >
            <Eye size={15} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((metric) => (
          <FaceMetricTile key={`${metric.label}-${metric.value}`} {...metric} />
        ))}
      </div>
    </section>
  );
}

function cardValueWithPercent(done: number, total: number): string {
  return `${formatGroupedInt(done)} (${formatCoveragePercent(done, total)})`;
}

function topTagsValue(summary: FolderFaceSummary): string {
  return summary.topPersonTags.slice(0, 3).map((tag) => `${tag.label} (${formatGroupedInt(tag.taggedFaceCount)})`).join(", ") || "—";
}

export function DesktopFolderFaceSummaryDashboard({
  selectedWithSubfolders,
}: {
  selectedWithSubfolders: FolderFaceSummary;
}): ReactElement {
  const [variant, setVariant] = useState<Variant>("b");
  const [detailKey, setDetailKey] = useState<DetailKey | null>(null);

  const detailText = useMemo(() => {
    if (!detailKey) return null;
    const tree = selectedWithSubfolders;
    if (detailKey === "coverage") {
      const missing = Math.max(0, tree.totalImages - tree.faceAnalyzedImages - tree.faceFailedImages);
      return `${formatGroupedInt(tree.faceAnalyzedImages)} images have completed face detection. ${formatGroupedInt(missing)} are not processed yet and ${formatGroupedInt(tree.faceFailedImages)} failed.`;
    }
    if (detailKey === "outcomes") {
      return `Detected ${formatGroupedInt(tree.detectedFaces)} faces across ${formatGroupedInt(tree.imagesWithFaces)} images with faces.`;
    }
    if (detailKey === "tagging") {
      return `${formatGroupedInt(tree.confirmedTaggedFaces)} detected faces have confirmed person-tags. ${formatGroupedInt(tree.suggestedUntaggedFaces)} untagged detected faces have an unconfirmed person suggestion from the similarity index. ${formatGroupedInt(tree.imagesWithDirectPersonTag)} images also have direct person-tags not tied to a face box.`;
    }
    if (detailKey === "ageGender") {
      return `${formatGroupedInt(tree.facesWithAgeGender)} detected faces have age and gender metadata. Kids are estimated under 18; adults are estimated 18 or older. ${formatGroupedInt(tree.facesMissingAgeGender)} faces still need that auxiliary model pass.`;
    }
    if (detailKey === "subjects") {
      return `Main-subject counts use the stored face subject role from face detection. ${formatGroupedInt(tree.oneMainSubjectWithBackgroundFaces)} images have one main subject plus additional background faces.`;
    }
    return topTagsValue(tree);
  }, [detailKey, selectedWithSubfolders]);

  const summary = selectedWithSubfolders;
  const missingFiles = Math.max(0, summary.totalImages - summary.faceAnalyzedImages - summary.faceFailedImages);
  const taggedPercent = formatCoveragePercent(summary.confirmedTaggedFaces, summary.detectedFaces);
  const ageGenderPercent = formatCoveragePercent(summary.facesWithAgeGender, summary.detectedFaces);

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit flex-wrap gap-2 border-b border-border pb-2">
        {([
          { id: "a", label: UI_TEXT.folderFaceSummaryVariantA },
          { id: "b", label: UI_TEXT.folderFaceSummaryVariantB },
          { id: "c", label: UI_TEXT.folderFaceSummaryVariantC },
        ] as const).map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "m-0 rounded-md border px-3 py-1.5 text-sm shadow-none",
              variant === item.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-input bg-secondary text-foreground",
            )}
            onClick={() => setVariant(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {variant === "a" ? (
        <div className="flex flex-wrap gap-3">
          <FaceInsightCard
            icon={<ScanFace size={24} />}
            title={UI_TEXT.folderFaceSummaryCardCoverage}
            metrics={[
              { label: "Processed images", value: cardValueWithPercent(summary.faceAnalyzedImages, summary.totalImages) },
              { label: "Missing / to do", value: formatGroupedInt(missingFiles), tone: "warning" },
              { label: "Failed", value: formatGroupedInt(summary.faceFailedImages), tone: summary.faceFailedImages > 0 ? "warning" : "muted" },
              { label: "Total images", value: formatGroupedInt(summary.totalImages), tone: "muted" },
            ]}
            onViewDetails={() => setDetailKey("coverage")}
          />
          <FaceInsightCard
            icon={<Users size={24} />}
            title={UI_TEXT.folderFaceSummaryCardOutcomes}
            metrics={[
              { label: "Detected faces", value: formatGroupedInt(summary.detectedFaces) },
              { label: "Images with faces", value: cardValueWithPercent(summary.imagesWithFaces, summary.totalImages) },
            ]}
            onViewDetails={() => setDetailKey("outcomes")}
          />
          <FaceInsightCard
            icon={<Tags size={24} />}
            title={UI_TEXT.folderFaceSummaryCardTagging}
            metrics={[
              { label: "Confirmed face tags", value: `${formatGroupedInt(summary.confirmedTaggedFaces)} (${taggedPercent})` },
              { label: "Suggested matches", value: formatGroupedInt(summary.suggestedUntaggedFaces) },
              { label: "Untagged faces", value: formatGroupedInt(summary.untaggedFaces), tone: "warning" },
              { label: "Direct image tags", value: formatGroupedInt(summary.imagesWithDirectPersonTag), tone: "muted" },
            ]}
            onViewDetails={() => setDetailKey("tagging")}
          />
          <FaceInsightCard
            icon={<UserRoundCheck size={24} />}
            title={UI_TEXT.folderFaceSummaryCardAgeGender}
            metrics={[
              { label: "Processed faces", value: `${formatGroupedInt(summary.facesWithAgeGender)} (${ageGenderPercent})` },
              { label: "Missing / to do", value: formatGroupedInt(summary.facesMissingAgeGender), tone: "warning" },
              { label: "Kids (<18)", value: formatGroupedInt(summary.childFaces) },
              { label: "Adults (18+)", value: formatGroupedInt(summary.adultFaces) },
            ]}
            onViewDetails={() => setDetailKey("ageGender")}
          />
        </div>
      ) : null}

      {variant === "b" ? (
        <div className="flex flex-wrap gap-3">
          <FaceInsightCard
            icon={<ScanFace size={24} />}
            title={UI_TEXT.folderFaceSummaryCardCoverage}
            metrics={[
              { label: "Processed", value: cardValueWithPercent(summary.faceAnalyzedImages, summary.totalImages) },
              { label: "To do", value: formatGroupedInt(missingFiles), tone: "warning" },
              { label: "Faces found", value: formatGroupedInt(summary.detectedFaces) },
              { label: "Images with faces", value: formatGroupedInt(summary.imagesWithFaces) },
            ]}
            onViewDetails={() => setDetailKey("coverage")}
          />
          <FaceInsightCard
            icon={<Tags size={24} />}
            title={UI_TEXT.folderFaceSummaryCardTagging}
            metrics={[
              { label: "Confirmed tags", value: `${formatGroupedInt(summary.confirmedTaggedFaces)} (${taggedPercent})` },
              { label: "Suggested matches", value: formatGroupedInt(summary.suggestedUntaggedFaces) },
              { label: "Top tags", value: topTagsValue(summary) },
            ]}
            onViewDetails={() => setDetailKey("topTags")}
          />
          <FaceInsightCard
            icon={<Users size={24} />}
            title={UI_TEXT.folderFaceSummaryCardMainSubjects}
            metrics={[
              { label: "One person", value: formatGroupedInt(summary.mainSubjectHistogram.oneMainSubject) },
              { label: "Two people", value: formatGroupedInt(summary.mainSubjectHistogram.twoMainSubjects) },
              { label: "Three people", value: formatGroupedInt(summary.mainSubjectHistogram.threeMainSubjects) },
              { label: "Four people", value: formatGroupedInt(summary.mainSubjectHistogram.fourMainSubjects) },
              { label: "Five+ people", value: formatGroupedInt(summary.mainSubjectHistogram.fiveOrMoreMainSubjects) },
              { label: "1 main + background", value: formatGroupedInt(summary.oneMainSubjectWithBackgroundFaces) },
            ]}
            onViewDetails={() => setDetailKey("subjects")}
          />
        </div>
      ) : null}

      {variant === "c" ? (
        <div className="grid gap-3">
          <FaceInsightCard
            icon={<ScanFace size={24} />}
            title={UI_TEXT.folderFaceSummaryCardCoverage}
            metrics={[
              { label: "Processed", value: formatGroupedInt(summary.faceAnalyzedImages) },
              { label: "To do", value: formatGroupedInt(missingFiles), tone: "warning" },
              { label: "Failed", value: formatGroupedInt(summary.faceFailedImages), tone: summary.faceFailedImages > 0 ? "warning" : "muted" },
            ]}
            onViewDetails={() => setDetailKey("coverage")}
          />
          <FaceInsightCard
            icon={<Users size={24} />}
            title={UI_TEXT.folderFaceSummaryCardOutcomes}
            metrics={[
              { label: "Faces", value: formatGroupedInt(summary.detectedFaces) },
              { label: "Images with faces", value: cardValueWithPercent(summary.imagesWithFaces, summary.totalImages) },
            ]}
            onViewDetails={() => setDetailKey("outcomes")}
          />
          <FaceInsightCard
            icon={<Tags size={24} />}
            title={UI_TEXT.folderFaceSummaryCardTopTags}
            metrics={[
              { label: "Top tags", value: topTagsValue(summary) },
              { label: "Confirmed face tags", value: `${formatGroupedInt(summary.confirmedTaggedFaces)} (${taggedPercent})` },
              { label: "Suggested matches", value: formatGroupedInt(summary.suggestedUntaggedFaces) },
            ]}
            onViewDetails={() => setDetailKey("topTags")}
          />
        </div>
      ) : null}

      {detailText ? (
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">{detailText}</div>
      ) : null}
    </div>
  );
}

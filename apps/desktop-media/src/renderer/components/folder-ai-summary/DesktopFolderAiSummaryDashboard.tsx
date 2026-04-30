import { Brain, Image as ImageIcon, RotateCw, Search, Users, Video } from "lucide-react";
import type { ReactElement } from "react";
import type { FolderAiCoverageReport, FolderAiSummaryOverview } from "../../../shared/ipc";
import { getFolderAiPipelineQueueStatus } from "../../lib/folder-ai-pipeline-queue-status";
import { UI_TEXT } from "../../lib/ui-text";
import { useDesktopStore } from "../../stores/desktop-store";
import type { SummaryPipelineKind } from "../../types/folder-ai-summary-types";
import { LastDataScanCard, SummaryMediaCountCard } from "./SummaryMediaCountCard";
import { SummaryGeoLocationCard } from "./SummaryGeoLocationCard";
import { SummaryPipelineCard } from "./SummaryPipelineCard";
import { SummarySettingsCheckbox } from "./SummarySettingsCheckbox";
import { pendingGeoCoverage, pendingOverview, pendingPipeline } from "./summary-card-formatters";

const pendingCoverage: FolderAiCoverageReport = {
  folderPath: "",
  recursive: true,
  totalImages: 0,
  photo: pendingPipeline,
  face: pendingPipeline,
  semantic: pendingPipeline,
  rotation: pendingPipeline,
  geo: {
    images: pendingGeoCoverage,
    videos: pendingGeoCoverage,
    locationDetails: { doneCount: 0, totalWithGps: 0, label: "empty" },
  },
};

export interface FolderAiSummaryDashboardCardVisibility {
  imagesCount: boolean;
  videosCount: boolean;
  lastDataScan: boolean;
  semantic: boolean;
  face: boolean;
  photo: boolean;
  rotation: boolean;
  geoLocation: boolean;
}

export const DEFAULT_FOLDER_AI_SUMMARY_CARD_VISIBILITY: FolderAiSummaryDashboardCardVisibility = {
  imagesCount: true,
  videosCount: true,
  lastDataScan: true,
  semantic: true,
  face: true,
  photo: true,
  rotation: true,
  geoLocation: true,
};

interface DesktopFolderAiSummaryDashboardProps {
  coverage?: FolderAiCoverageReport;
  overview?: FolderAiSummaryOverview;
  loading?: boolean;
  overviewLoading?: boolean;
  folderScanLoading?: boolean;
  coverageLoading?: boolean;
  hasSubfolders?: boolean;
  actionPendingPipeline?: SummaryPipelineKind | null;
  onRunPipeline?: (pipeline: SummaryPipelineKind) => void;
  actionPendingFolderScan?: boolean;
  onRunFolderScan?: () => void;
  cardVisibility?: Partial<FolderAiSummaryDashboardCardVisibility>;
}

export function DesktopFolderAiSummaryDashboard({
  coverage = pendingCoverage,
  overview = pendingOverview,
  loading = false,
  overviewLoading = loading && overview === pendingOverview,
  folderScanLoading = overviewLoading,
  coverageLoading = loading,
  hasSubfolders = false,
  actionPendingPipeline = null,
  onRunPipeline,
  actionPendingFolderScan = false,
  onRunFolderScan,
  cardVisibility,
}: DesktopFolderAiSummaryDashboardProps): ReactElement {
  const outdatedAfterDays = useDesktopStore(
    (state) => state.folderScanningSettings.markFolderScanOutdatedAfterDays,
  );
  const pipelineRunning = useDesktopStore((state) => state.pipelineRunning);
  const pipelineQueued = useDesktopStore((state) => state.pipelineQueued);
  const visible = { ...DEFAULT_FOLDER_AI_SUMMARY_CARD_VISIBILITY, ...cardVisibility };
  const showImagePipelineSection = visible.semantic || visible.face || visible.photo || visible.rotation;
  const queueStatusFor = (pipeline: SummaryPipelineKind) =>
    getFolderAiPipelineQueueStatus({
      running: pipelineRunning,
      queued: pipelineQueued,
      pipeline,
      folderPath: coverage.folderPath,
    });
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-3">
        {visible.imagesCount ? (
          <SummaryMediaCountCard
            icon={ImageIcon}
            label={UI_TEXT.folderAiSummaryColumnImages}
            count={overview.totalImages}
            loading={overviewLoading}
          />
        ) : null}
        {visible.videosCount ? (
          <SummaryMediaCountCard
            icon={Video}
            label={UI_TEXT.folderAiSummaryColumnVideos}
            count={overview.totalVideos}
            loading={overviewLoading}
          />
        ) : null}
        {visible.lastDataScan ? (
          <LastDataScanCard
            scanFreshness={overview.scanFreshness}
            hasSubfolders={hasSubfolders}
            loading={folderScanLoading}
            actionPending={actionPendingFolderScan}
            outdatedAfterDays={outdatedAfterDays}
            onRunFolderScan={onRunFolderScan}
          />
        ) : null}
      </div>

      {showImagePipelineSection ? (
        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-sm font-semibold text-muted-foreground">
            {UI_TEXT.folderAiSummaryDashboardImagesSection}
          </h3>
          <div className="flex flex-wrap gap-3">
            {visible.semantic ? (
              <SummaryPipelineCard
                icon={Search}
                title={UI_TEXT.folderAiSummaryColumnSemantic}
                pipeline={coverage.semantic}
                actionPipeline="semantic"
                loading={coverageLoading}
                actionPending={actionPendingPipeline === "semantic"}
                queueStatus={queueStatusFor("semantic")}
                onRunPipeline={onRunPipeline}
              />
            ) : null}
            {visible.face ? (
              <SummaryPipelineCard
                icon={Users}
                title={UI_TEXT.folderAiSummaryColumnFace}
                pipeline={coverage.face}
                actionPipeline="face"
                loading={coverageLoading}
                actionPending={actionPendingPipeline === "face"}
                queueStatus={queueStatusFor("face")}
                onRunPipeline={onRunPipeline}
              />
            ) : null}
            {visible.photo ? (
              <SummaryPipelineCard
                icon={Brain}
                title={UI_TEXT.folderAiSummaryColumnPhoto}
                pipeline={coverage.photo}
                actionPipeline="photo"
                loading={coverageLoading}
                actionPending={actionPendingPipeline === "photo"}
                queueStatus={queueStatusFor("photo")}
                onRunPipeline={onRunPipeline}
              />
            ) : null}
            {visible.rotation ? (
              <SummaryPipelineCard
                icon={RotateCw}
                title={UI_TEXT.folderAiSummaryColumnRotation}
                pipeline={coverage.rotation}
                actionPipeline="rotation"
                loading={coverageLoading}
                actionPending={actionPendingPipeline === "rotation"}
                queueStatus={queueStatusFor("rotation")}
                onRunPipeline={onRunPipeline}
                completedLabel="analyzed"
                issueLabel="wrongly rotated"
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {visible.geoLocation ? (
        <section className="flex flex-col gap-3" aria-label={UI_TEXT.folderAiSummaryDashboardPrototypeVariants}>
          <h3 className="m-0 text-sm font-semibold text-muted-foreground">{UI_TEXT.folderAiSummaryGeoLocation}</h3>
          <div className="flex flex-wrap gap-3">
            <SummaryGeoLocationCard coverage={coverage} loading={coverageLoading} />
          </div>
        </section>
      ) : null}

      <div className="pt-1">
        <SummarySettingsCheckbox />
      </div>
    </div>
  );
}

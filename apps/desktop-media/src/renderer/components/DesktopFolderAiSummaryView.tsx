import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { RefreshCw, X } from "lucide-react";
import type {
  DesktopMediaItemMetadata,
  FolderAiCoverageReport,
  FolderAiFailedFileItem,
  FolderAiPipelineKind,
  FolderAiSummaryOverviewReport,
} from "../../shared/ipc";
import { useFolderAiSummaryPipelineActions } from "../hooks/use-folder-ai-summary-pipeline-actions";
import { cn } from "../lib/cn";
import {
  shouldRefreshFolderAiSummaryAfterPipeline,
  shouldRefreshFolderAiSummaryAfterScan,
} from "../lib/folder-ai-summary-scan-refresh";
import { UI_TEXT } from "../lib/ui-text";
import type { FailedListContext, SummaryPipelineKind } from "../types/folder-ai-summary-types";
import { DesktopFolderAiFailedList } from "./DesktopFolderAiFailedList";
import { DesktopFolderAiSummaryDashboard } from "./DesktopFolderAiSummaryDashboard";
import { DesktopFolderAiSummaryTable } from "./DesktopFolderAiSummaryTable";
import { DesktopFolderGeoSummaryTable } from "./DesktopFolderGeoSummaryTable";
import { DesktopFolderFaceSummaryTable } from "./DesktopFolderFaceSummaryTable";
import { PendingSpinner } from "./folder-ai-summary/SummaryStatusGlyph";
import { useDesktopStore } from "../stores/desktop-store";
import { useFolderAiSummaryTableStream } from "../hooks/use-folder-ai-summary-table-stream";
import { useFolderFaceSummaryStream } from "../hooks/use-folder-face-summary-stream";
import { PipelineOnboardingModal, type PipelineOnboardingSlideId } from "./folder-ai-summary/PipelineOnboardingModal";

type SummaryTab = "summary" | "face" | "ai" | "geo";

const DEBUG_FOLDER_AI_SUMMARY = true;

function debugFolderAiSummary(message: string, details?: Record<string, unknown>): void {
  if (!DEBUG_FOLDER_AI_SUMMARY) return;
  console.log("[debug][folder-ai-summary]", message, details ?? {});
}

interface DesktopFolderAiSummaryViewProps {
  folderPath: string;
  onBackToPhotos: () => void;
  onRunSemanticPipeline?: (folderPath: string, recursive: boolean, overrideExisting: boolean) => Promise<void> | void;
  onRunFacePipeline?: (folderPath: string, recursive: boolean, overrideExisting: boolean) => Promise<void> | void;
  onRunPhotoPipeline?: (folderPath: string, recursive: boolean, overrideExisting: boolean) => Promise<void> | void;
  /** Same as sidebar row menu "Folder AI analysis summary" for the given path. */
  onOpenFolderSummary?: (folderPath: string) => void;
  onOpenRotationReview?: (folderPath: string, includeSubfolders: boolean) => void;
}

function SummaryTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: SummaryTab;
  onTabChange: (tab: SummaryTab) => void;
}): ReactElement {
  const tabs: Array<{ id: SummaryTab; label: string }> = [
    { id: "summary", label: UI_TEXT.folderAiSummaryTabSummary },
    { id: "ai", label: UI_TEXT.folderAiSummaryTabAiPipelines },
    { id: "face", label: UI_TEXT.folderAiSummaryTabFaceDetection },
    { id: "geo", label: UI_TEXT.folderAiSummaryTabGeoLocation },
  ];
  return (
    <div className="inline-flex w-fit flex-wrap gap-2 border-b border-border" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={cn(
            "m-0 rounded-none border-0 border-b-2 bg-transparent px-3 py-2 text-xl font-semibold shadow-none",
            activeTab === tab.id
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function DetailsLoadingSpinner(): ReactElement {
  return (
    <div className="flex min-h-[220px] items-center justify-center" aria-label={UI_TEXT.folderAiSummaryLoading}>
      <PendingSpinner className="h-14 w-14" />
    </div>
  );
}

export function DesktopFolderAiSummaryView({
  folderPath,
  onBackToPhotos,
  onRunSemanticPipeline,
  onRunFacePipeline,
  onRunPhotoPipeline,
  onOpenFolderSummary,
  onOpenRotationReview,
}: DesktopFolderAiSummaryViewProps): ReactElement {
  const lastMetadataScanCompletion = useDesktopStore((state) => state.lastMetadataScanCompletion);
  const lastAiPipelineCompletion = useDesktopStore((state) => state.lastAiPipelineCompletion);
  const selectedFolderChildrenCount = useDesktopStore((state) => state.childrenByPath[folderPath]?.length ?? 0);
  const folderScanOutdatedAfterDays = useDesktopStore(
    (state) => state.folderScanningSettings.markFolderScanOutdatedAfterDays,
  );
  const loadSequenceRef = useRef(0);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [folderScanLoading, setFolderScanLoading] = useState(true);
  const [coverageLoading, setCoverageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWithSubfolders, setSelectedWithSubfolders] = useState<FolderAiCoverageReport | null>(null);
  const [selectedDirectOnly, setSelectedDirectOnly] = useState<FolderAiCoverageReport | null>(null);
  const [overviewReport, setOverviewReport] = useState<FolderAiSummaryOverviewReport | null>(null);
  const [activeTab, setActiveTab] = useState<SummaryTab>("summary");
  const [failedListContext, setFailedListContext] = useState<FailedListContext | null>(null);
  const [failedListLoading, setFailedListLoading] = useState(false);
  const [failedListError, setFailedListError] = useState<string | null>(null);
  const [failedListItems, setFailedListItems] = useState<FolderAiFailedFileItem[]>([]);
  const [failedListMetaByPath, setFailedListMetaByPath] = useState<Record<string, DesktopMediaItemMetadata>>({});
  const [folderScanPending, setFolderScanPending] = useState(false);
  const [onboardingSlideId, setOnboardingSlideId] = useState<PipelineOnboardingSlideId>("face");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const {
    actionPendingPipeline,
    runPipelineForFolderWithSubfolders,
  } = useFolderAiSummaryPipelineActions({
    folderPath,
    onRunSemanticPipeline,
    onRunFacePipeline,
    onRunPhotoPipeline,
  });

  const load = useCallback(async () => {
    if (!folderPath) return;
    const loadSequence = loadSequenceRef.current + 1;
    loadSequenceRef.current = loadSequence;
    const loadStartedAt = performance.now();
    debugFolderAiSummary("renderer:load-start", { folderPath, loadSequence });
    setOverviewLoading(true);
    setFolderScanLoading(true);
    setCoverageLoading(true);
    setError(null);
    setOverviewReport(null);
    setSelectedWithSubfolders(null);
    setSelectedDirectOnly(null);
    try {
      const overviewStartedAt = performance.now();
      const overviewPromise = window.desktopApi.getFolderAiSummaryOverview(folderPath, { includeSubfolders: false });
      const folderScanStartedAt = performance.now();
      const folderScanPromise = window.desktopApi.getFolderTreeScanSummary(folderPath, folderScanOutdatedAfterDays);
      const coverageStartedAt = performance.now();
      const coveragePromise = Promise.all([
        window.desktopApi.getFolderAiCoverage(folderPath, true),
        window.desktopApi.getFolderAiCoverage(folderPath, false),
      ]);

      const overviewUpdate = overviewPromise
        .then((overview) => {
          if (loadSequenceRef.current !== loadSequence) return;
          setOverviewReport(overview);
          setOverviewLoading(false);
          debugFolderAiSummary("renderer:overview-received", {
            folderPath,
            loadSequence,
            elapsedMs: Math.round(performance.now() - overviewStartedAt),
            totalImages: overview.selectedWithSubfolders.totalImages,
            totalVideos: overview.selectedWithSubfolders.totalVideos,
          });
        })
        .catch(() => {
          if (loadSequenceRef.current !== loadSequence) return;
          setError(UI_TEXT.folderAiSummaryError);
          setOverviewLoading(false);
        });

      const folderScanUpdate = folderScanPromise
        .then((scanSummary) => {
          if (loadSequenceRef.current !== loadSequence) return;
          setOverviewReport((current) => {
            if (!current) return current;
            return {
              ...current,
              hasDirectSubfolders: scanSummary.hasDirectSubfolders,
              selectedWithSubfolders: {
                ...current.selectedWithSubfolders,
                scanFreshness: {
                  ...current.selectedWithSubfolders.scanFreshness,
                  directSubfolderCount: scanSummary.directSubfolderCount,
                  notFullyScannedDirectSubfolderCount: scanSummary.notFullyScannedDirectSubfolderCount,
                  outdatedScannedFolderCount: scanSummary.outdatedScannedFolderCount,
                  scannedFolderCount: scanSummary.scannedFolderCount,
                },
              },
            };
          });
          setFolderScanLoading(false);
          debugFolderAiSummary("renderer:tree-scan-received", {
            folderPath,
            loadSequence,
            elapsedMs: Math.round(performance.now() - folderScanStartedAt),
            hasDirectSubfolders: scanSummary.hasDirectSubfolders,
            directSubfolderCount: scanSummary.directSubfolderCount,
            notFullyScannedDirectSubfolderCount: scanSummary.notFullyScannedDirectSubfolderCount,
            outdatedScannedFolderCount: scanSummary.outdatedScannedFolderCount,
            scannedFolderCount: scanSummary.scannedFolderCount,
          });
        })
        .catch(() => {
          if (loadSequenceRef.current !== loadSequence) return;
          setError(UI_TEXT.folderAiSummaryError);
          setFolderScanLoading(false);
        });

      const coverageUpdate = coveragePromise
        .then(([withSubfolders, directOnly]) => {
          if (loadSequenceRef.current !== loadSequence) return;
          setSelectedWithSubfolders(withSubfolders);
          setSelectedDirectOnly(directOnly);
          setCoverageLoading(false);
          debugFolderAiSummary("renderer:coverage-received", {
            folderPath,
            loadSequence,
            elapsedMs: Math.round(performance.now() - coverageStartedAt),
            totalImages: withSubfolders.totalImages,
          });
        })
        .catch(() => {
          if (loadSequenceRef.current !== loadSequence) return;
          setError(UI_TEXT.folderAiSummaryError);
          setCoverageLoading(false);
        });

      await Promise.allSettled([overviewUpdate, folderScanUpdate, coverageUpdate]);
    } catch {
      if (loadSequenceRef.current !== loadSequence) return;
      setError(UI_TEXT.folderAiSummaryError);
      setSelectedWithSubfolders(null);
      setSelectedDirectOnly(null);
    } finally {
      if (loadSequenceRef.current === loadSequence) {
        setOverviewLoading(false);
        setFolderScanLoading(false);
        setCoverageLoading(false);
        debugFolderAiSummary("renderer:load-complete", {
          folderPath,
          loadSequence,
          elapsedMs: Math.round(performance.now() - loadStartedAt),
        });
      }
    }
  }, [folderPath, folderScanOutdatedAfterDays]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (shouldRefreshFolderAiSummaryAfterScan(folderPath, lastMetadataScanCompletion)) {
      void load();
    }
  }, [folderPath, lastMetadataScanCompletion, load]);

  useEffect(() => {
    if (shouldRefreshFolderAiSummaryAfterPipeline(folderPath, lastAiPipelineCompletion)) {
      void load();
    }
  }, [folderPath, lastAiPipelineCompletion, load]);

  useEffect(() => {
    if (failedListItems.length === 0) {
      setFailedListMetaByPath({});
      return;
    }
    let cancelled = false;
    const loadMeta = async (): Promise<void> => {
      try {
        const byPath = await window.desktopApi.getMediaItemsByPaths(failedListItems.map((item) => item.path));
        if (!cancelled) setFailedListMetaByPath(byPath);
      } catch {
        if (!cancelled) setFailedListMetaByPath({});
      }
    };
    void loadMeta();
    return () => {
      cancelled = true;
    };
  }, [failedListItems]);

  const loadFailedList = useCallback(async (context: FailedListContext): Promise<void> => {
    setFailedListLoading(true);
    setFailedListError(null);
    try {
      const items = await window.desktopApi.getFolderAiFailedFiles(
        context.folderPath,
        context.pipeline,
        context.recursive,
      );
      setFailedListItems(items);
    } catch {
      setFailedListItems([]);
      setFailedListError(UI_TEXT.folderAiSummaryFailedListError);
    } finally {
      setFailedListLoading(false);
    }
  }, []);

  const openFailedList = useCallback(
    (targetFolderPath: string, pipeline: FolderAiPipelineKind, recursive: boolean, folderLabel: string): void => {
      const context: FailedListContext = { folderPath: targetFolderPath, pipeline, recursive, folderLabel };
      setFailedListContext(context);
      void loadFailedList(context);
    },
    [loadFailedList],
  );

  const runFolderScanWithSubfolders = useCallback(async (): Promise<void> => {
    if (!folderPath || folderScanPending) return;
    setFolderScanPending(true);
    try {
      await window.desktopApi.scanFolderMetadata({ folderPath, recursive: true });
      await load();
    } finally {
      setFolderScanPending(false);
    }
  }, [folderPath, folderScanPending, load]);

  const runDashboardPipeline = useCallback(
    async (pipeline: SummaryPipelineKind): Promise<void> => {
      await runPipelineForFolderWithSubfolders(pipeline);
      if (pipeline === "rotation") {
        await load();
      }
    },
    [load, runPipelineForFolderWithSubfolders],
  );

  const openOnboarding = useCallback((pipeline: SummaryPipelineKind | "geo" | "folderScan"): void => {
    if (pipeline === "face" || pipeline === "rotation") {
      setOnboardingSlideId(pipeline);
      setOnboardingOpen(true);
      return;
    }
    if (pipeline === "geo" || pipeline === "folderScan") {
      setOnboardingSlideId(pipeline);
      setOnboardingOpen(true);
    }
  }, []);

  const iconBtnClass =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input bg-secondary p-0 shadow-none";
  const isFailedListView = failedListContext !== null;
  const loading = overviewLoading || folderScanLoading || coverageLoading;
  const hasSubfolders =
    selectedFolderChildrenCount > 0 ||
    (overviewReport ? overviewReport.hasDirectSubfolders || overviewReport.subfolders.length > 0 : false);
  const summaryTitle = hasSubfolders ? UI_TEXT.folderAiSummaryTreeTitle : UI_TEXT.folderAiSummaryFolderTitle;
  const dashboardCoverage = hasSubfolders ? selectedWithSubfolders : selectedDirectOnly;
  const dashboardOverview = hasSubfolders ? overviewReport?.selectedWithSubfolders : overviewReport?.selectedDirectOnly;
  const failedListPipelineLabel =
    failedListContext?.pipeline === "photo"
      ? UI_TEXT.folderAiSummaryColumnPhoto
      : failedListContext?.pipeline === "face"
        ? UI_TEXT.folderAiSummaryColumnFace
        : UI_TEXT.folderAiSummaryColumnSemantic;

  const faceStreamEnabled =
    activeTab === "face" &&
    !loading &&
    !error &&
    !isFailedListView &&
    Boolean(selectedWithSubfolders && selectedDirectOnly && dashboardCoverage);

  const faceStream = useFolderFaceSummaryStream(folderPath, faceStreamEnabled);

  const aiGeoStreamEnabled =
    (activeTab === "ai" || activeTab === "geo") &&
    !loading &&
    !error &&
    !isFailedListView &&
    Boolean(selectedWithSubfolders && selectedDirectOnly && dashboardCoverage);

  const aiGeoStream = useFolderAiSummaryTableStream(folderPath, aiGeoStreamEnabled);

  const summaryPageStickyStackRef = useRef<HTMLDivElement>(null);
  const [stickyStackHeightPx, setStickyStackHeightPx] = useState(88);

  const showSummaryTabs =
    !loading &&
    !error &&
    !isFailedListView &&
    Boolean(selectedWithSubfolders && selectedDirectOnly && dashboardCoverage);

  useLayoutEffect(() => {
    const el = summaryPageStickyStackRef.current;
    if (!el) return;
    const measure = (): void => {
      setStickyStackHeightPx(Math.ceil(el.getBoundingClientRect().height));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return (): void => {
      ro.disconnect();
    };
  }, [showSummaryTabs, activeTab, summaryTitle, isFailedListView, folderPath, loading, error]);

  const stickyStackCssVar: CSSProperties = {
    ["--folder-ai-sticky-stack-offset" as string]: `${stickyStackHeightPx}px`,
  };

  return (
    <div className="relative flex w-full max-w-screen-2xl flex-col gap-0 px-5 py-4" style={stickyStackCssVar}>
      <div
        ref={summaryPageStickyStackRef}
        className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3 pt-1">
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-lg">
              {isFailedListView ? UI_TEXT.folderAiSummaryFailedListTitle : summaryTitle}
            </h2>
            <p className="m-0 mt-1 break-all text-sm text-muted-foreground">{folderPath}</p>
          </div>
          <div className="inline-flex shrink-0 items-center gap-2">
            {!loading ? (
              <button
                type="button"
                className={iconBtnClass}
                onClick={() => {
                  if (failedListContext) void loadFailedList(failedListContext);
                  else {
                    void load();
                    if (activeTab === "face") faceStream.refresh();
                    if (activeTab === "ai" || activeTab === "geo") aiGeoStream.refresh();
                  }
                }}
                aria-label={UI_TEXT.folderAiSummaryRefresh}
                title={UI_TEXT.folderAiSummaryRefresh}
              >
                <RefreshCw size={18} aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              className={iconBtnClass}
              onClick={onBackToPhotos}
              aria-label={UI_TEXT.folderAiSummaryBack}
              title={UI_TEXT.folderAiSummaryBack}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        {showSummaryTabs ? <SummaryTabs activeTab={activeTab} onTabChange={setActiveTab} /> : null}
      </div>

      {isFailedListView ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            className="m-0 inline-flex h-8 items-center justify-center rounded-md border border-input bg-secondary px-3 text-sm shadow-none"
            onClick={() => setFailedListContext(null)}
          >
            {UI_TEXT.folderAiSummaryFailedListBack}
          </button>
          <p className="m-0 text-sm text-muted-foreground">
            {`${failedListPipelineLabel} - ${failedListContext.folderLabel}`}
          </p>
        </div>
      ) : null}

      {error ? <p className="m-0 mt-4 text-red-400">{error}</p> : null}

      {!error && !isFailedListView && (loading || !selectedWithSubfolders || !selectedDirectOnly || !dashboardCoverage) ? (
        <div className="mt-4">
          <DesktopFolderAiSummaryDashboard
            coverage={dashboardCoverage ?? undefined}
            overview={dashboardOverview}
            hasSubfolders={hasSubfolders}
            overviewLoading={overviewLoading || !dashboardOverview}
            folderScanLoading={folderScanLoading || !dashboardOverview}
            coverageLoading={coverageLoading || !dashboardCoverage}
          />
        </div>
      ) : null}

      {!loading && !error && !isFailedListView && selectedWithSubfolders && selectedDirectOnly && dashboardCoverage ? (
        <>
          {activeTab === "summary" ? (
            <div className="mt-4">
              <DesktopFolderAiSummaryDashboard
                coverage={dashboardCoverage}
                overview={dashboardOverview}
                hasSubfolders={hasSubfolders}
                overviewLoading={overviewLoading || !dashboardOverview}
                folderScanLoading={folderScanLoading || !dashboardOverview}
                coverageLoading={coverageLoading}
                actionPendingPipeline={actionPendingPipeline}
                onRunPipeline={(pipeline) => void runDashboardPipeline(pipeline)}
                actionPendingGeoLocation={folderScanPending}
                onRunGeoLocation={() => void runFolderScanWithSubfolders()}
                onOpenPipelineInfo={openOnboarding}
                onViewRotationResults={
                  (dashboardCoverage.rotation.issueCount ?? 0) > 0 && onOpenRotationReview
                    ? () => onOpenRotationReview(folderPath, true)
                    : undefined
                }
                actionPendingFolderScan={folderScanPending}
                onRunFolderScan={() => void runFolderScanWithSubfolders()}
              />
            </div>
          ) : null}
          {activeTab === "face" ? (
            faceStream.streamError && faceStream.rowSpecs.length === 0 ? (
              <p className="m-0 text-sm text-red-400">{faceStream.streamError}</p>
            ) : faceStream.rowSpecs.length === 0 ? (
              <DetailsLoadingSpinner />
            ) : (
              <DesktopFolderFaceSummaryTable
                rootFolderPath={folderPath}
                rowSpecs={faceStream.rowSpecs}
                summariesByRowId={faceStream.summariesByRowId}
                coverageByRowId={faceStream.coverageByRowId}
                allDone={faceStream.allDone}
                streamError={faceStream.streamError}
                onOpenFolderSummary={onOpenFolderSummary}
                onOpenFailedList={openFailedList}
                onRunPipeline={(pipeline) => void runPipelineForFolderWithSubfolders(pipeline)}
                actionPendingPipeline={actionPendingPipeline}
              />
            )
          ) : null}
          {activeTab === "ai" ? (
            aiGeoStream.streamError && aiGeoStream.rowSpecs.length === 0 ? (
              <p className="m-0 text-sm text-red-400">{aiGeoStream.streamError}</p>
            ) : aiGeoStream.rowSpecs.length === 0 ? (
              <DetailsLoadingSpinner />
            ) : (
              <DesktopFolderAiSummaryTable
                folderPath={folderPath}
                selectedWithSubfolders={aiGeoStream.selectedWithSubfolders}
                selectedDirectOnly={aiGeoStream.selectedDirectOnly}
                subfolders={aiGeoStream.subfolders}
                streamRowsIncomplete={!aiGeoStream.allDone}
                streamError={aiGeoStream.streamError}
                onRunPipeline={(pipeline) => void runPipelineForFolderWithSubfolders(pipeline)}
                actionPendingPipeline={actionPendingPipeline}
                onOpenFolderSummary={onOpenFolderSummary}
                onOpenFailedList={openFailedList}
                onOpenWronglyRotatedImages={
                  onOpenRotationReview
                    ? (reviewFolderPath) => onOpenRotationReview(reviewFolderPath, true)
                    : undefined
                }
              />
            )
          ) : null}
          {activeTab === "geo" ? (
            aiGeoStream.streamError && aiGeoStream.rowSpecs.length === 0 ? (
              <p className="m-0 text-sm text-red-400">{aiGeoStream.streamError}</p>
            ) : aiGeoStream.rowSpecs.length === 0 ? (
              <DetailsLoadingSpinner />
            ) : (
              <DesktopFolderGeoSummaryTable
                folderPath={folderPath}
                selectedWithSubfolders={aiGeoStream.selectedWithSubfolders}
                selectedDirectOnly={aiGeoStream.selectedDirectOnly}
                subfolders={aiGeoStream.subfolders}
                streamRowsIncomplete={!aiGeoStream.allDone}
                streamError={aiGeoStream.streamError}
                onOpenFolderSummary={onOpenFolderSummary}
              />
            )
          ) : null}
        </>
      ) : null}

      {isFailedListView ? (
        <DesktopFolderAiFailedList
          loading={failedListLoading}
          error={failedListError}
          items={failedListItems}
          metaByPath={failedListMetaByPath}
        />
      ) : null}

      <PipelineOnboardingModal
        open={onboardingOpen}
        initialSlideId={onboardingSlideId}
        onClose={() => setOnboardingOpen(false)}
      />
    </div>
  );
}

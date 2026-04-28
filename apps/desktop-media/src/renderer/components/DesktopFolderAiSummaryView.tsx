import { useCallback, useEffect, useState, type ReactElement } from "react";
import { RefreshCw, X } from "lucide-react";
import type {
  DesktopMediaItemMetadata,
  FolderAiCoverageReport,
  FolderAiFailedFileItem,
  FolderAiPipelineKind,
  FolderAiSummaryOverviewReport,
  FolderAiSummaryReport,
} from "../../shared/ipc";
import { useFolderAiSummaryPipelineActions } from "../hooks/use-folder-ai-summary-pipeline-actions";
import { cn } from "../lib/cn";
import { shouldRefreshFolderAiSummaryAfterScan } from "../lib/folder-ai-summary-scan-refresh";
import { isPathWithinParent } from "../lib/is-path-within-parent";
import { UI_TEXT } from "../lib/ui-text";
import type { FailedListContext, SummaryPipelineKind } from "../types/folder-ai-summary-types";
import { DesktopFolderAiFailedList } from "./DesktopFolderAiFailedList";
import { DesktopFolderAiSummaryDashboard } from "./DesktopFolderAiSummaryDashboard";
import { DesktopFolderAiSummaryTable } from "./DesktopFolderAiSummaryTable";
import { DesktopFolderGeoSummaryTable } from "./DesktopFolderGeoSummaryTable";
import { PendingSpinner } from "./folder-ai-summary/SummaryStatusGlyph";
import { PipelineBlockedDialog } from "./PipelineBlockedDialog";
import { useDesktopStore } from "../stores/desktop-store";

type SummaryTab = "summary" | "ai" | "geo";

interface DesktopFolderAiSummaryViewProps {
  folderPath: string;
  onBackToPhotos: () => void;
  onRunSemanticPipeline?: (folderPath: string, recursive: boolean, overrideExisting: boolean) => Promise<void> | void;
  onRunFacePipeline?: (folderPath: string, recursive: boolean, overrideExisting: boolean) => Promise<void> | void;
  onRunPhotoPipeline?: (folderPath: string, recursive: boolean, overrideExisting: boolean) => Promise<void> | void;
  /** Same as sidebar row menu "Folder AI analysis summary" for the given path. */
  onOpenFolderSummary?: (folderPath: string) => void;
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
}: DesktopFolderAiSummaryViewProps): ReactElement {
  const lastMetadataScanCompletion = useDesktopStore((state) => state.lastMetadataScanCompletion);
  const lastAiPipelineCompletion = useDesktopStore((state) => state.lastAiPipelineCompletion);
  const selectedFolderChildrenCount = useDesktopStore((state) => state.childrenByPath[folderPath]?.length ?? 0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWithSubfolders, setSelectedWithSubfolders] = useState<FolderAiCoverageReport | null>(null);
  const [selectedDirectOnly, setSelectedDirectOnly] = useState<FolderAiCoverageReport | null>(null);
  const [overviewReport, setOverviewReport] = useState<FolderAiSummaryOverviewReport | null>(null);
  const [subfolders, setSubfolders] = useState<FolderAiSummaryReport["subfolders"]>([]);
  const [activeTab, setActiveTab] = useState<SummaryTab>("summary");
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [failedListContext, setFailedListContext] = useState<FailedListContext | null>(null);
  const [failedListLoading, setFailedListLoading] = useState(false);
  const [failedListError, setFailedListError] = useState<string | null>(null);
  const [failedListItems, setFailedListItems] = useState<FolderAiFailedFileItem[]>([]);
  const [failedListMetaByPath, setFailedListMetaByPath] = useState<Record<string, DesktopMediaItemMetadata>>({});
  const [folderScanPending, setFolderScanPending] = useState(false);
  const {
    actionPendingPipeline,
    showPipelineBlockedDialog,
    setShowPipelineBlockedDialog,
    runPipelineForFolderWithSubfolders,
  } = useFolderAiSummaryPipelineActions({
    folderPath,
    onRunSemanticPipeline,
    onRunFacePipeline,
    onRunPhotoPipeline,
  });

  const load = useCallback(async () => {
    if (!folderPath) return;
    setLoading(true);
    setError(null);
    setDetailsError(null);
    setDetailsLoaded(false);
    setOverviewReport(null);
    const overviewPromise = window.desktopApi
      .getFolderAiSummaryOverview(folderPath)
      .then((overview) => setOverviewReport(overview))
      .catch(() => undefined);
    try {
      const [withSubfolders, directOnly] = await Promise.all([
        window.desktopApi.getFolderAiCoverage(folderPath, true),
        window.desktopApi.getFolderAiCoverage(folderPath, false),
      ]);
      setSelectedWithSubfolders(withSubfolders);
      setSelectedDirectOnly(directOnly);
      setSubfolders([]);
      setActiveTab("summary");
      void overviewPromise;
    } catch {
      setError(UI_TEXT.folderAiSummaryError);
      setSelectedWithSubfolders(null);
      setSelectedDirectOnly(null);
      setSubfolders([]);
    } finally {
      setLoading(false);
    }
  }, [folderPath]);

  const loadDetails = useCallback(async (): Promise<void> => {
    if (!folderPath || detailsLoaded || detailsLoading) return;
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const report = await window.desktopApi.getFolderAiSummaryReport(folderPath);
      setSelectedWithSubfolders(report.selectedWithSubfolders);
      setSelectedDirectOnly(report.selectedDirectOnly);
      setSubfolders(report.subfolders);
      setDetailsLoaded(true);
    } catch {
      setDetailsError(UI_TEXT.folderAiSummaryError);
    } finally {
      setDetailsLoading(false);
    }
  }, [detailsLoaded, detailsLoading, folderPath]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (shouldRefreshFolderAiSummaryAfterScan(folderPath, lastMetadataScanCompletion)) {
      void load();
    }
  }, [folderPath, lastMetadataScanCompletion, load]);

  useEffect(() => {
    if (!lastAiPipelineCompletion) return;
    if (
      lastAiPipelineCompletion.folderPath === folderPath ||
      isPathWithinParent(lastAiPipelineCompletion.folderPath, folderPath) ||
      isPathWithinParent(folderPath, lastAiPipelineCompletion.folderPath)
    ) {
      void load();
    }
  }, [folderPath, lastAiPipelineCompletion, load]);

  useEffect(() => {
    if (activeTab === "ai" || activeTab === "geo") {
      void loadDetails();
    }
  }, [activeTab, loadDetails]);

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

  const iconBtnClass =
    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input bg-secondary p-0 shadow-none";
  const isFailedListView = failedListContext !== null;
  const hasSubfolders =
    selectedFolderChildrenCount > 0 ||
    (overviewReport ? overviewReport.subfolders.length > 0 : subfolders.length > 0);
  const summaryTitle = hasSubfolders ? UI_TEXT.folderAiSummaryTreeTitle : UI_TEXT.folderAiSummaryFolderTitle;
  const dashboardCoverage = hasSubfolders ? selectedWithSubfolders : selectedDirectOnly;
  const dashboardOverview = hasSubfolders ? overviewReport?.selectedWithSubfolders : overviewReport?.selectedDirectOnly;
  const failedListPipelineLabel =
    failedListContext?.pipeline === "photo"
      ? UI_TEXT.folderAiSummaryColumnPhoto
      : failedListContext?.pipeline === "face"
        ? UI_TEXT.folderAiSummaryColumnFace
        : UI_TEXT.folderAiSummaryColumnSemantic;

  return (
    <div className="relative flex w-full max-w-screen-2xl flex-col gap-4 px-5 py-4">
      <div className="sticky top-0 z-20 flex flex-wrap items-start justify-between gap-3 border-b border-border bg-background/95 pb-3 pt-1 backdrop-blur">
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
                else void load();
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

      {isFailedListView ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
      ) : (
        <p className="m-0 text-sm text-muted-foreground">{UI_TEXT.folderAiSummaryNote}</p>
      )}

      {error ? <p className="m-0 text-red-400">{error}</p> : null}
      {detailsError ? <p className="m-0 text-red-400">{detailsError}</p> : null}

      {loading && !error && !isFailedListView ? (
        <DesktopFolderAiSummaryDashboard overview={dashboardOverview} hasSubfolders={hasSubfolders} loading />
      ) : null}

      {!loading && !error && !isFailedListView && selectedWithSubfolders && selectedDirectOnly && dashboardCoverage ? (
        <>
          <SummaryTabs activeTab={activeTab} onTabChange={setActiveTab} />
          {activeTab === "summary" ? (
            <DesktopFolderAiSummaryDashboard
              coverage={dashboardCoverage}
              overview={dashboardOverview}
              hasSubfolders={hasSubfolders}
              actionPendingPipeline={actionPendingPipeline}
              onRunPipeline={(pipeline) => void runDashboardPipeline(pipeline)}
              actionPendingFolderScan={folderScanPending}
              onRunFolderScan={() => void runFolderScanWithSubfolders()}
            />
          ) : null}
          {activeTab === "ai" ? (
            !detailsLoaded ? (
              <DetailsLoadingSpinner />
            ) : (
              <DesktopFolderAiSummaryTable
                folderPath={folderPath}
                selectedWithSubfolders={selectedWithSubfolders}
                selectedDirectOnly={selectedDirectOnly}
                subfolders={subfolders}
                onRunPipeline={(pipeline) => void runPipelineForFolderWithSubfolders(pipeline)}
                actionPendingPipeline={actionPendingPipeline}
                onOpenFolderSummary={onOpenFolderSummary}
                onOpenFailedList={openFailedList}
              />
            )
          ) : null}
          {activeTab === "geo" ? (
            !detailsLoaded ? (
              <DetailsLoadingSpinner />
            ) : (
              <DesktopFolderGeoSummaryTable
                selectedWithSubfolders={selectedWithSubfolders}
                selectedDirectOnly={selectedDirectOnly}
                subfolders={subfolders}
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

      {showPipelineBlockedDialog ? (
        <PipelineBlockedDialog onClose={() => setShowPipelineBlockedDialog(false)} />
      ) : null}
    </div>
  );
}

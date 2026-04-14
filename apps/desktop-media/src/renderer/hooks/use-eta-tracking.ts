import { useEffect, useMemo, useState } from "react";
import { ETA_MIN_RECENT_SAMPLES, ETA_RECENT_WINDOW_SIZE, formatTimeLeftCompact } from "../lib/eta-formatting";
import { UI_TEXT } from "../lib/ui-text";
import { useDesktopStore } from "../stores/desktop-store";

interface JobItem {
  status: string;
  elapsedSeconds?: number;
  result?: unknown;
  faceCount?: number;
}

function roundUpToMinuteSeconds(totalSeconds: number): number {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return 0;
  return Math.ceil(totalSeconds / 60) * 60;
}

function computeAvgSecondsPerProcessed(
  items: JobItem[],
  skipNoResult: boolean,
): number | null {
  const settledWithElapsed = items.filter((item) => {
    if (
      item.status !== "success" &&
      item.status !== "failed" &&
      item.status !== "cancelled"
    ) {
      return false;
    }
    if (skipNoResult && item.status === "success" && !item.result) {
      return false;
    }
    return (
      typeof item.elapsedSeconds === "number" &&
      Number.isFinite(item.elapsedSeconds) &&
      item.elapsedSeconds > 0
    );
  });
  if (settledWithElapsed.length === 0) {
    return null;
  }
  const recentSample =
    settledWithElapsed.length <= ETA_RECENT_WINDOW_SIZE
      ? settledWithElapsed
      : settledWithElapsed.slice(-ETA_RECENT_WINDOW_SIZE);
  const sample =
    recentSample.length >= ETA_MIN_RECENT_SAMPLES
      ? recentSample
      : settledWithElapsed;
  const totalElapsed = sample.reduce((sum, item) => sum + (item.elapsedSeconds ?? 0), 0);
  return totalElapsed / sample.length;
}

interface JobCounts {
  success: number;
  failed: number;
  cancelled: number;
  running: number;
  skipped: number;
}

function computeJobCounts(items: JobItem[], skipNoResult: boolean): JobCounts {
  return items.reduce(
    (acc, item) => {
      if (item.status === "success") acc.success += 1;
      if (item.status === "failed") acc.failed += 1;
      if (item.status === "cancelled") acc.cancelled += 1;
      if (item.status === "running") acc.running += 1;
      if (skipNoResult && item.status === "success" && !item.result) {
        acc.skipped += 1;
      }
      return acc;
    },
    { success: 0, failed: 0, cancelled: 0, running: 0, skipped: 0 },
  );
}

export interface AnalysisEtaState {
  analysisItems: JobItem[];
  analysisCounts: JobCounts;
  analysisProcessed: number;
  analysisTotal: number;
  analysisProgressPercent: number;
  analysisTimeLeftText: string | null;
}

export function useAnalysisEta(): AnalysisEtaState {
  const aiStatus = useDesktopStore((s) => s.aiStatus);
  const aiJobId = useDesktopStore((s) => s.aiJobId);
  const aiItemsByKey = useDesktopStore((s) => s.aiItemsByKey);
  const aiItemOrder = useDesktopStore((s) => s.aiItemOrder);
  const isAnalyzing = aiStatus === "running";

  const analysisItems = useMemo(
    () => aiItemOrder.map((path) => aiItemsByKey[path]).filter(Boolean),
    [aiItemsByKey, aiItemOrder],
  );
  const analysisCounts = useMemo(
    () => computeJobCounts(analysisItems, true),
    [analysisItems],
  );
  const analysisAvgSecondsPerProcessed = useMemo(
    () => computeAvgSecondsPerProcessed(analysisItems, true),
    [analysisItems],
  );

  const analysisProcessed = analysisCounts.success + analysisCounts.failed + analysisCounts.cancelled;
  const analysisTotal = aiItemOrder.length;
  const analysisRemainingForEta = analysisItems.filter(
    (item) => item.status === "pending" || item.status === "running",
  ).length;
  const analysisEtaCandidateSeconds =
    isAnalyzing && analysisAvgSecondsPerProcessed !== null
      ? roundUpToMinuteSeconds(
          Math.max(0, analysisRemainingForEta * analysisAvgSecondsPerProcessed),
        )
      : null;
  const analysisProgressPercent =
    analysisTotal > 0 ? Math.min(100, Math.round((analysisProcessed / analysisTotal) * 100)) : 0;

  const [analysisEtaTargetMs, setAnalysisEtaTargetMs] = useState<number | null>(null);
  const [analysisEtaTickMs, setAnalysisEtaTickMs] = useState<number>(Date.now());

  useEffect(() => {
    if (!isAnalyzing || analysisEtaCandidateSeconds === null) {
      setAnalysisEtaTargetMs(null);
      return;
    }
    setAnalysisEtaTargetMs(Date.now() + analysisEtaCandidateSeconds * 1000);
  }, [isAnalyzing, analysisEtaCandidateSeconds, aiJobId]);

  useEffect(() => {
    if (!isAnalyzing || analysisEtaTargetMs === null) {
      return;
    }
    const timer = window.setInterval(() => {
      setAnalysisEtaTickMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isAnalyzing, analysisEtaTargetMs]);

  const analysisTimeLeftText =
    isAnalyzing && analysisEtaTargetMs !== null
      ? formatTimeLeftCompact((analysisEtaTargetMs - analysisEtaTickMs) / 1000)
      : null;

  return {
    analysisItems,
    analysisCounts,
    analysisProcessed,
    analysisTotal,
    analysisProgressPercent,
    analysisTimeLeftText,
  };
}

export interface FaceEtaState {
  faceItems: Array<JobItem & { faceCount?: number }>;
  faceCounts: JobCounts & { faces: number };
  faceProcessed: number;
  faceTotal: number;
  faceProgressPercent: number;
  faceTimeLeftText: string | null;
}

export function useFaceDetectionEta(): FaceEtaState {
  const faceStatus = useDesktopStore((s) => s.faceStatus);
  const faceJobId = useDesktopStore((s) => s.faceJobId);
  const faceItemsByKey = useDesktopStore((s) => s.faceItemsByKey);
  const faceItemOrder = useDesktopStore((s) => s.faceItemOrder);
  const isDetectingFaces = faceStatus === "running";

  const faceItems = useMemo(
    () => faceItemOrder.map((path) => faceItemsByKey[path]).filter(Boolean),
    [faceItemsByKey, faceItemOrder],
  );
  const faceCounts = useMemo(
    () =>
      faceItems.reduce(
        (acc, item) => {
          if (item.status === "success") acc.success += 1;
          if (item.status === "failed") acc.failed += 1;
          if (item.status === "cancelled") acc.cancelled += 1;
          if (item.status === "running") acc.running += 1;
          acc.faces += item.faceCount ?? 0;
          if (item.status === "success" && !item.result) {
            acc.skipped += 1;
          }
          return acc;
        },
        { success: 0, failed: 0, cancelled: 0, running: 0, faces: 0, skipped: 0 },
      ),
    [faceItems],
  );
  const faceAvgSecondsPerProcessed = useMemo(
    () => computeAvgSecondsPerProcessed(faceItems, false),
    [faceItems],
  );

  const faceProcessed = faceCounts.success + faceCounts.failed + faceCounts.cancelled;
  const faceTotal = faceItemOrder.length;
  const faceRemainingForEta = faceItems.filter(
    (item) => item.status === "pending" || item.status === "running",
  ).length;
  const faceEtaCandidateSeconds =
    isDetectingFaces && faceAvgSecondsPerProcessed !== null
      ? roundUpToMinuteSeconds(Math.max(0, faceRemainingForEta * faceAvgSecondsPerProcessed))
      : null;
  const faceProgressPercent =
    faceTotal > 0 ? Math.min(100, Math.round((faceProcessed / faceTotal) * 100)) : 0;

  const [faceEtaTargetMs, setFaceEtaTargetMs] = useState<number | null>(null);
  const [faceEtaTickMs, setFaceEtaTickMs] = useState<number>(Date.now());

  useEffect(() => {
    if (!isDetectingFaces || faceEtaCandidateSeconds === null) {
      setFaceEtaTargetMs(null);
      return;
    }
    setFaceEtaTargetMs(Date.now() + faceEtaCandidateSeconds * 1000);
  }, [isDetectingFaces, faceEtaCandidateSeconds, faceJobId]);

  useEffect(() => {
    if (!isDetectingFaces || faceEtaTargetMs === null) {
      return;
    }
    const timer = window.setInterval(() => {
      setFaceEtaTickMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isDetectingFaces, faceEtaTargetMs]);

  const faceTimeLeftText =
    isDetectingFaces && faceEtaTargetMs !== null
      ? formatTimeLeftCompact((faceEtaTargetMs - faceEtaTickMs) / 1000)
      : null;

  return {
    faceItems,
    faceCounts,
    faceProcessed,
    faceTotal,
    faceProgressPercent,
    faceTimeLeftText,
  };
}

export interface SemanticIndexEtaState {
  semanticIndexItems: JobItem[];
  semanticIndexCounts: JobCounts;
  semanticIndexProcessed: number;
  semanticIndexTotal: number;
  semanticIndexProgressPercent: number;
  semanticIndexTimeLeftText: string | null;
}

export function useSemanticIndexEta(): SemanticIndexEtaState {
  const semanticIndexStatus = useDesktopStore((s) => s.semanticIndexStatus);
  const semanticIndexJobId = useDesktopStore((s) => s.semanticIndexJobId);
  const semanticIndexItemsByKey = useDesktopStore((s) => s.semanticIndexItemsByKey);
  const semanticIndexItemOrder = useDesktopStore((s) => s.semanticIndexItemOrder);
  const isIndexing = semanticIndexStatus === "running";

  const semanticIndexItems = useMemo(
    () => semanticIndexItemOrder.map((path) => semanticIndexItemsByKey[path]).filter(Boolean),
    [semanticIndexItemsByKey, semanticIndexItemOrder],
  );
  const semanticIndexCounts = useMemo(
    () => computeJobCounts(semanticIndexItems, false),
    [semanticIndexItems],
  );
  const semanticIndexAvgSeconds = useMemo(
    () => computeAvgSecondsPerProcessed(semanticIndexItems, false),
    [semanticIndexItems],
  );

  const semanticIndexProcessed = semanticIndexCounts.success + semanticIndexCounts.failed + semanticIndexCounts.cancelled;
  const semanticIndexTotal = semanticIndexItemOrder.length;
  const semanticIndexRemaining = semanticIndexItems.filter(
    (item) => item.status === "pending" || item.status === "running",
  ).length;
  const semanticIndexEtaCandidate =
    isIndexing && semanticIndexAvgSeconds !== null
      ? roundUpToMinuteSeconds(Math.max(0, semanticIndexRemaining * semanticIndexAvgSeconds))
      : null;
  const semanticIndexProgressPercent =
    semanticIndexTotal > 0 ? Math.min(100, Math.round((semanticIndexProcessed / semanticIndexTotal) * 100)) : 0;

  const [semanticIndexEtaTargetMs, setSemanticIndexEtaTargetMs] = useState<number | null>(null);
  const [semanticIndexEtaTickMs, setSemanticIndexEtaTickMs] = useState<number>(Date.now());

  useEffect(() => {
    if (!isIndexing || semanticIndexEtaCandidate === null) {
      setSemanticIndexEtaTargetMs(null);
      return;
    }
    setSemanticIndexEtaTargetMs(Date.now() + semanticIndexEtaCandidate * 1000);
  }, [isIndexing, semanticIndexEtaCandidate, semanticIndexJobId]);

  useEffect(() => {
    if (!isIndexing || semanticIndexEtaTargetMs === null) {
      return;
    }
    const timer = window.setInterval(() => {
      setSemanticIndexEtaTickMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isIndexing, semanticIndexEtaTargetMs]);

  const semanticIndexTimeLeftText =
    isIndexing && semanticIndexEtaTargetMs !== null
      ? formatTimeLeftCompact((semanticIndexEtaTargetMs - semanticIndexEtaTickMs) / 1000)
      : null;

  return {
    semanticIndexItems,
    semanticIndexCounts,
    semanticIndexProcessed,
    semanticIndexTotal,
    semanticIndexProgressPercent,
    semanticIndexTimeLeftText,
  };
}

export interface MetadataProgressState {
  metadataProcessed: number;
  metadataTotal: number;
  metadataDisplayProgressPercent: number;
  metadataProgressLabel: string | null;
  metadataFolderName: string | null;
  metadataCardTitle: string;
  metadataCounts: {
    running: number;
    created: number;
    updated: number;
    unchanged: number;
    failed: number;
    cancelled: number;
  };
}

export function useMetadataProgress(): MetadataProgressState {
  const metadataStatus = useDesktopStore((s) => s.metadataStatus);
  const metadataSummary = useDesktopStore((s) => s.metadataSummary);
  const metadataCurrentFolderPath = useDesktopStore((s) => s.metadataCurrentFolderPath);
  const metadataPhase = useDesktopStore((s) => s.metadataPhase);
  const metadataPhaseProcessed = useDesktopStore((s) => s.metadataPhaseProcessed);
  const metadataPhaseTotal = useDesktopStore((s) => s.metadataPhaseTotal);
  const metadataItemsByKey = useDesktopStore((s) => s.metadataItemsByKey);
  const isMetadataScanning = metadataStatus === "running";

  const metadataCounts = useMemo(() => {
    if (metadataSummary) {
      return {
        running: 0,
        created: metadataSummary.created,
        updated: metadataSummary.updated,
        unchanged: metadataSummary.unchanged,
        failed: metadataSummary.failed,
        cancelled: metadataSummary.cancelled,
      };
    }
    if (isMetadataScanning && metadataPhase === "scanning") {
      let created = 0;
      let updated = 0;
      let failed = 0;
      let cancelled = 0;
      for (const item of Object.values(metadataItemsByKey)) {
        if (item.status === "cancelled") {
          cancelled += 1;
        } else if (item.status === "failed" || item.action === "failed") {
          failed += 1;
        } else if (item.action === "created") {
          created += 1;
        } else if (item.action === "updated") {
          updated += 1;
        }
      }
      const processedSoFar = metadataPhaseProcessed;
      const unchanged = Math.max(0, processedSoFar - created - updated - failed - cancelled);
      return { running: 0, created, updated, unchanged, failed, cancelled };
    }
    return { running: 0, created: 0, updated: 0, unchanged: 0, failed: 0, cancelled: 0 };
  }, [metadataSummary, isMetadataScanning, metadataPhase, metadataItemsByKey, metadataPhaseProcessed]);

  const metadataTotal = metadataSummary?.total ?? metadataPhaseTotal;
  const metadataProcessed = metadataSummary
    ? metadataCounts.created +
      metadataCounts.updated +
      metadataCounts.unchanged +
      metadataCounts.failed +
      metadataCounts.cancelled
    : isMetadataScanning && metadataPhase === "scanning"
      ? metadataPhaseProcessed
      : isMetadataScanning && metadataPhase === "preparing"
        ? metadataPhaseProcessed
        : metadataCounts.created +
          metadataCounts.updated +
          metadataCounts.unchanged +
          metadataCounts.failed +
          metadataCounts.cancelled;
  const metadataProgressPercent =
    metadataTotal > 0 ? Math.min(100, Math.round((metadataProcessed / metadataTotal) * 100)) : 0;
  const metadataPhaseProgressPercent =
    metadataPhaseTotal > 0
      ? Math.min(100, Math.round((metadataPhaseProcessed / metadataPhaseTotal) * 100))
      : 0;
  const metadataDisplayProgressPercent =
    isMetadataScanning && metadataPhase ? metadataPhaseProgressPercent : metadataProgressPercent;
  const metadataProgressLabel = metadataPhase === "preparing" ? UI_TEXT.metadataScanPreparing : null;
  const metadataFolderName =
    isMetadataScanning && metadataCurrentFolderPath
      ? metadataCurrentFolderPath.split(/[\\/]/).pop() ?? null
      : null;
  const metadataCardTitle =
    metadataPhase === "preparing"
      ? UI_TEXT.metadataPreparingCardTitle
      : metadataPhase === "scanning"
        ? UI_TEXT.metadataScanScanningCardTitle
        : UI_TEXT.metadataScanCardTitle;

  return {
    metadataProcessed,
    metadataTotal,
    metadataDisplayProgressPercent,
    metadataProgressLabel,
    metadataFolderName,
    metadataCardTitle,
    metadataCounts,
  };
}

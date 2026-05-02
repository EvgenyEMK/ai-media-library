import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type {
  FolderAiCoverageReport,
  FolderFaceSummary,
  FolderFaceSummaryStreamEvent,
  FolderFaceSummaryStreamRowSpec,
} from "../../shared/ipc";

export interface UseFolderFaceSummaryStreamResult {
  rowSpecs: FolderFaceSummaryStreamRowSpec[];
  summariesByRowId: Record<string, FolderFaceSummary>;
  coverageByRowId: Record<string, FolderAiCoverageReport>;
  allDone: boolean;
  streamError: string | null;
  refresh: () => void;
}

export function useFolderFaceSummaryStream(
  folderPath: string,
  enabled: boolean,
): UseFolderFaceSummaryStreamResult {
  const [rowSpecs, setRowSpecs] = useState<FolderFaceSummaryStreamRowSpec[]>([]);
  const [summariesByRowId, setSummariesByRowId] = useState<Record<string, FolderFaceSummary>>({});
  const [coverageByRowId, setCoverageByRowId] = useState<Record<string, FolderAiCoverageReport>>({});
  const [allDone, setAllDone] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const activeJobIdRef = useRef<string | null>(null);

  const refresh = useCallback((): void => {
    setRefreshToken((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !folderPath.trim()) {
      setRowSpecs([]);
      setSummariesByRowId({});
      setCoverageByRowId({});
      setAllDone(false);
      setStreamError(null);
      activeJobIdRef.current = null;
      return;
    }

    const normalized = folderPath.trim();
    const myJobId = crypto.randomUUID();
    activeJobIdRef.current = myJobId;

    setRowSpecs([]);
    setSummariesByRowId({});
    setCoverageByRowId({});
    setAllDone(false);
    setStreamError(null);

    const unsubscribe = window.desktopApi.onFolderFaceSummaryProgress((payload: FolderFaceSummaryStreamEvent) => {
      if (payload.jobId !== myJobId || activeJobIdRef.current !== myJobId) return;
      if (payload.kind === "row") {
        flushSync(() => {
          setSummariesByRowId((prev) => ({ ...prev, [payload.rowId]: payload.summary }));
          setCoverageByRowId((prev) => ({ ...prev, [payload.rowId]: payload.coverage }));
        });
      } else if (payload.kind === "done") {
        setAllDone(true);
      } else if (payload.kind === "error") {
        setAllDone(true);
        setStreamError(payload.message === "cancelled" ? null : payload.message);
      }
    });

    void (async (): Promise<void> => {
      try {
        const start = await window.desktopApi.startFolderFaceSummaryStream(normalized, myJobId);
        if (activeJobIdRef.current !== myJobId) {
          await window.desktopApi.cancelFolderFaceSummaryStream(start.jobId);
          return;
        }
        setRowSpecs(start.rows);
      } catch {
        if (activeJobIdRef.current === myJobId) {
          setStreamError("Could not load face summary.");
          setAllDone(true);
        }
      }
    })();

    return () => {
      unsubscribe();
      if (activeJobIdRef.current === myJobId) {
        void window.desktopApi.cancelFolderFaceSummaryStream(myJobId);
        activeJobIdRef.current = null;
      }
    };
  }, [enabled, folderPath, refreshToken]);

  return {
    rowSpecs,
    summariesByRowId,
    coverageByRowId,
    allDone,
    streamError,
    refresh,
  };
}

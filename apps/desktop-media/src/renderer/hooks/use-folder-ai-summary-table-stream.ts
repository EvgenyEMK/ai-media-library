import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type {
  FolderAiCoverageReport,
  FolderAiSummaryStreamEvent,
  FolderFaceSummaryStreamRowSpec,
} from "../../shared/ipc";
import {
  deriveFolderAiSummaryTableProps,
  type DerivedFolderAiSummaryTableProps,
} from "../lib/folder-ai-summary-table-props";

export interface UseFolderAiSummaryTableStreamResult extends DerivedFolderAiSummaryTableProps {
  rowSpecs: FolderFaceSummaryStreamRowSpec[];
  coverageByRowId: Record<string, FolderAiCoverageReport>;
  allDone: boolean;
  streamError: string | null;
  refresh: () => void;
}

export function useFolderAiSummaryTableStream(
  folderPath: string,
  enabled: boolean,
): UseFolderAiSummaryTableStreamResult {
  const [rowSpecs, setRowSpecs] = useState<FolderFaceSummaryStreamRowSpec[]>([]);
  const [coverageByRowId, setCoverageByRowId] = useState<Record<string, FolderAiCoverageReport>>({});
  const [allDone, setAllDone] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const activeJobIdRef = useRef<string | null>(null);

  const derived = useMemo(
    () => deriveFolderAiSummaryTableProps(rowSpecs, coverageByRowId),
    [rowSpecs, coverageByRowId],
  );

  const refresh = useCallback((): void => {
    setRefreshToken((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !folderPath.trim()) {
      setRowSpecs([]);
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
    setCoverageByRowId({});
    setAllDone(false);
    setStreamError(null);

    const unsubscribe = window.desktopApi.onFolderAiSummaryStreamProgress((payload: FolderAiSummaryStreamEvent) => {
      if (payload.jobId !== myJobId || activeJobIdRef.current !== myJobId) return;
      if (payload.kind === "row") {
        flushSync(() => {
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
        const start = await window.desktopApi.startFolderAiSummaryStream(normalized, myJobId);
        if (activeJobIdRef.current !== myJobId) {
          await window.desktopApi.cancelFolderAiSummaryStream(start.jobId);
          return;
        }
        setRowSpecs(start.rows);
      } catch {
        if (activeJobIdRef.current === myJobId) {
          setStreamError("Could not load folder AI summary.");
          setAllDone(true);
        }
      }
    })();

    return () => {
      unsubscribe();
      if (activeJobIdRef.current === myJobId) {
        void window.desktopApi.cancelFolderAiSummaryStream(myJobId);
        activeJobIdRef.current = null;
      }
    };
  }, [enabled, folderPath, refreshToken]);

  return {
    ...derived,
    rowSpecs,
    coverageByRowId,
    allDone,
    streamError,
    refresh,
  };
}

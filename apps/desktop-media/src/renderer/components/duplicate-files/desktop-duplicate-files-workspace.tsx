import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { FolderDuplicateScanResultPayload, FolderDuplicateScanRow } from "../../../shared/ipc";
import { PeoplePaginationBar } from "../people-pagination-bar";
import { ALBUM_ITEMS_PAGE_SIZE } from "../DesktopAlbumDetailPanel";
import { enqueueDuplicateMarkedFilesDelete } from "../../actions/duplicate-files-actions";
import { cn } from "../../lib/cn";
import {
  collectDuplicateDeleteTargetsForColumn,
  countDistinctParentFolders,
  sumByteSizesForPaths,
  type DuplicateDeleteColumn,
} from "../../lib/duplicate-files-marked-delete-aggregate";
import {
  formatComparablePathForDisplay,
  inferPathDisplayStyle,
} from "../../lib/duplicate-files-display-paths";
import { comparableFilePath } from "../../lib/media-metadata-lookup";
import { useDesktopStore } from "../../stores/desktop-store";
import {
  buildDuplicateFolderSummaries,
  rowMatchesFolderFilter,
  splitDuplicateFolderSummariesBySelectionDiskTree,
} from "../../lib/duplicate-files-folder-aggregate";
import { dedupeMutualSingletonDuplicateRowsForFolderFilter } from "../../lib/duplicate-files-symmetric-folder-drilldown-rows";
import { normalizedScanRoot, parentFolderPath } from "../../lib/duplicate-files-folder-scope";
import {
  countScopedFilesWithDuplicateInsideDiskTree,
  countScopedFilesWithDuplicateOutsideDiskTree,
  totalByteSizeOfDuplicatesInsideDiskTree,
  totalByteSizeOfDuplicatesOutsideDiskTree,
} from "../../lib/duplicate-files-outside-selection-stats";
import { useDuplicateMarkedFilesDeleteCompletion } from "../../hooks/use-duplicate-marked-files-delete-completion";
import { DuplicateFilesByFolderPanel, type DuplicateFolderPickRegion } from "./duplicate-files-by-folder-panel";
import { DuplicateFilesDeleteConfirmDialog } from "./DuplicateFilesDeleteConfirmDialog";
import { DuplicateResultRow } from "./duplicate-files-result-row";

type DuplicateViewMode = "by-folder" | "by-file";

function isDuplicateMarkedFilesDeletePipelineBusy(s: {
  pipelineRunning: { jobs: { pipelineId: string; state: string }[] }[];
  pipelineQueued: { jobs: { pipelineId: string; state: string }[] }[];
}): boolean {
  const bundles = [...s.pipelineRunning, ...s.pipelineQueued];
  for (const b of bundles) {
    for (const j of b.jobs) {
      if (j.pipelineId !== "duplicate-marked-files-delete") {
        continue;
      }
      if (j.state === "running" || j.state === "pending") {
        return true;
      }
    }
  }
  return false;
}

function DupColumnToolbarRow({
  markedInColumn,
  showSelectAll,
  showClearAll,
  onSelectAll,
  onClearAll,
  deleteDisabled,
  onRequestDelete,
}: {
  markedInColumn: number;
  showSelectAll: boolean;
  showClearAll: boolean;
  onSelectAll: () => void;
  onClearAll: () => void;
  deleteDisabled: boolean;
  onRequestDelete: () => void;
}): ReactElement {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-8 gap-y-2 pt-2 text-sm text-muted-foreground">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {showSelectAll ? (
          <button
            type="button"
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
            onClick={onSelectAll}
          >
            Select all
          </button>
        ) : null}
        {showClearAll ? (
          <button
            type="button"
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
            onClick={onClearAll}
          >
            Clear all
          </button>
        ) : null}
      </div>
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <span className="whitespace-nowrap">To delete: {markedInColumn}</span>
        <button
          type="button"
          disabled={deleteDisabled}
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors",
            deleteDisabled
              ? "cursor-not-allowed opacity-50"
              : "hover:bg-muted/40 hover:text-foreground",
          )}
          title={deleteDisabled ? "Nothing to delete or deletion in progress" : "Delete marked files in this column"}
          aria-label={deleteDisabled ? "Delete marked in this column (unavailable)" : "Delete marked in this column"}
          onClick={onRequestDelete}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function FoldersWithDupHeaderLine({ text }: { text: string | null }): ReactElement {
  if (text == null) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  if (/\d+ folders$/.test(text)) {
    return <span className="text-sm font-medium text-muted-foreground">{text}</span>;
  }
  return <span className="break-all font-mono text-sm font-medium text-foreground">{text}</span>;
}

export function DesktopDuplicateFilesWorkspace({
  payload,
  currentPage,
  onPageChange,
  onClose,
  onDeletedMediaItems,
}: {
  payload: FolderDuplicateScanResultPayload;
  currentPage: number;
  onPageChange: (page: number) => void;
  onClose: () => void;
  /** Called after disk + catalog delete succeeds for the given media item ids. */
  onDeletedMediaItems?: (mediaItemIds: readonly string[]) => void;
}): ReactElement {
  const dateFormat = useDesktopStore((s) => s.mediaViewerSettings.dateFormat);
  const rows = payload.rows;

  const [viewMode, setViewMode] = useState<DuplicateViewMode>("by-folder");
  const [filterFolder, setFilterFolder] = useState<string | null>(null);
  const [filterFolderRegion, setFilterFolderRegion] = useState<DuplicateFolderPickRegion | null>(null);
  const [markedForDelete, setMarkedForDelete] = useState<ReadonlySet<string>>(() => new Set());
  const [folderMediaCounts, setFolderMediaCounts] = useState<Record<string, number>>({});
  const [selectionScopeMediaCount, setSelectionScopeMediaCount] = useState<number | null>(null);
  const [deleteDialogColumn, setDeleteDialogColumn] = useState<DuplicateDeleteColumn | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const duplicateDeletePipelineBusy = useDesktopStore(isDuplicateMarkedFilesDeletePipelineBusy);

  const folderSummaries = useMemo(() => buildDuplicateFolderSummaries(payload), [payload]);

  const { outside: outsideSummaries, inside: insideSummaries } = useMemo(
    () => splitDuplicateFolderSummariesBySelectionDiskTree(folderSummaries, payload.folderPath),
    [folderSummaries, payload.folderPath],
  );

  const scopedWithDuplicateOutsideCount = useMemo(
    () => countScopedFilesWithDuplicateOutsideDiskTree(payload),
    [payload],
  );

  const scopedWithDuplicateInsideCount = useMemo(
    () => countScopedFilesWithDuplicateInsideDiskTree(payload),
    [payload],
  );

  const outsideDuplicateBytesTotal = useMemo(
    () => totalByteSizeOfDuplicatesOutsideDiskTree(payload),
    [payload],
  );

  const insideDuplicateBytesTotal = useMemo(
    () => totalByteSizeOfDuplicatesInsideDiskTree(payload),
    [payload],
  );

  const selectionRootComparable = useMemo(() => normalizedScanRoot(payload.folderPath), [payload.folderPath]);
  const selectionRootLower = selectionRootComparable.toLowerCase();

  const hasSelectionSubfolders = useMemo(() => {
    if (payload.recursive) {
      return true;
    }
    return insideSummaries.some((s) => comparableFilePath(s.folderPath).toLowerCase() !== selectionRootLower);
  }, [insideSummaries, payload.recursive, selectionRootLower]);

  const folderPathsForCounts = useMemo(() => {
    const u = new Set<string>();
    for (const s of outsideSummaries) {
      u.add(s.folderPath);
    }
    for (const s of insideSummaries) {
      u.add(s.folderPath);
    }
    return [...u].sort();
  }, [outsideSummaries, insideSummaries]);

  useEffect(() => {
    if (folderPathsForCounts.length === 0) {
      setFolderMediaCounts({});
      return;
    }
    let cancelled = false;
    void window.desktopApi.countMediaItemsByParentFolders({ folderPaths: folderPathsForCounts }).then((res) => {
      if (cancelled) {
        return;
      }
      if (res.ok) {
        setFolderMediaCounts(res.counts);
      } else {
        setFolderMediaCounts({});
      }
    });
    return () => {
      cancelled = true;
    };
  }, [folderPathsForCounts]);

  useEffect(() => {
    let cancelled = false;
    void window.desktopApi
      .countMediaItemsInFolderScope({
        folderPath: payload.folderPath,
        recursive: payload.recursive,
      })
      .then((res) => {
        if (cancelled) {
          return;
        }
        if (res.ok) {
          setSelectionScopeMediaCount(res.count);
        } else {
          setSelectionScopeMediaCount(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [payload.folderPath, payload.recursive]);

  useEffect(() => {
    setViewMode("by-folder");
    setFilterFolder(null);
    setFilterFolderRegion(null);
    setMarkedForDelete(new Set());
  }, [payload]);

  useEffect(() => {
    if (filterFolder == null) {
      setFilterFolderRegion(null);
    }
  }, [filterFolder]);

  const filteredRows = useMemo((): FolderDuplicateScanRow[] => {
    if (!filterFolder) return rows;
    const matched = rows.filter((row) => rowMatchesFolderFilter(row, filterFolder));
    return dedupeMutualSingletonDuplicateRowsForFolderFilter(matched, filterFolder);
  }, [rows, filterFolder]);

  const pageSliceFullList = useMemo(() => {
    const base = currentPage * ALBUM_ITEMS_PAGE_SIZE;
    return filteredRows.slice(base, base + ALBUM_ITEMS_PAGE_SIZE);
  }, [filteredRows, currentPage]);

  const paginationTotal = filteredRows.length;

  const pathStyle = useMemo(
    () =>
      inferPathDisplayStyle(
        (filterFolder && filterFolderRegion === "inside" ? filterFolder : payload.folderPath).trim(),
      ),
    [filterFolder, filterFolderRegion, payload.folderPath],
  );

  const scanRootComparable = useMemo(() => comparableFilePath(payload.folderPath.trim()), [payload.folderPath]);

  const workspacePathDisplay = useMemo(
    () => formatComparablePathForDisplay(scanRootComparable, pathStyle),
    [scanRootComparable, pathStyle],
  );

  const selectedFolderSubheaderDisplay = useMemo(() => {
    if (!filterFolder || !filterFolderRegion) {
      return workspacePathDisplay;
    }
    if (filterFolderRegion === "outside") {
      return workspacePathDisplay;
    }
    return formatComparablePathForDisplay(comparableFilePath(filterFolder.trim()), pathStyle);
  }, [filterFolder, filterFolderRegion, workspacePathDisplay, pathStyle]);

  const foldersWithDupSubheaderText = useMemo((): string | null => {
    if (!filterFolder || !filterFolderRegion) {
      return null;
    }
    if (filterFolderRegion === "outside") {
      return formatComparablePathForDisplay(comparableFilePath(filterFolder.trim()), pathStyle);
    }
    const map = new Map<string, string>();
    for (const row of filteredRows) {
      for (const d of row.duplicates) {
        const p = comparableFilePath(parentFolderPath(d.sourcePath));
        if (p) {
          map.set(p.toLowerCase(), p);
        }
      }
    }
    const folders = [...map.values()].sort((a, b) => a.localeCompare(b));
    if (folders.length === 0) {
      return null;
    }
    if (folders.length === 1) {
      return formatComparablePathForDisplay(folders[0]!, pathStyle);
    }
    return `${folders.length} folders`;
  }, [filterFolder, filterFolderRegion, filteredRows, pathStyle]);

  const selectedColumnRootComparable = useMemo(() => {
    if (filterFolder && filterFolderRegion === "inside") {
      return comparableFilePath(filterFolder.trim());
    }
    return scanRootComparable;
  }, [filterFolder, filterFolderRegion, scanRootComparable]);

  const pageMarkKeys = useMemo(() => {
    const scoped: string[] = [];
    const dup: string[] = [];
    for (const row of pageSliceFullList) {
      scoped.push(`scoped:${row.mediaItemId}`);
      for (const d of row.duplicates) {
        dup.push(`dup:${d.mediaItemId}`);
      }
    }
    return { scoped, dup };
  }, [pageSliceFullList]);

  const scopedColumnTargets = useMemo(
    () => collectDuplicateDeleteTargetsForColumn(filteredRows, markedForDelete, "scoped"),
    [filteredRows, markedForDelete],
  );
  const dupColumnTargets = useMemo(
    () => collectDuplicateDeleteTargetsForColumn(filteredRows, markedForDelete, "dup"),
    [filteredRows, markedForDelete],
  );

  const deleteInProgress = duplicateDeletePipelineBusy || deleteSubmitting;

  const handleDeletedMediaItemIds = useCallback(
    (ids: readonly string[]) => {
      onDeletedMediaItems?.(ids);
      setMarkedForDelete((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          next.delete(`scoped:${id}`);
          next.delete(`dup:${id}`);
        }
        return next;
      });
    },
    [onDeletedMediaItems],
  );

  useDuplicateMarkedFilesDeleteCompletion(handleDeletedMediaItemIds);

  const deleteDialogTargets = useMemo(() => {
    if (!deleteDialogColumn) {
      return [];
    }
    return collectDuplicateDeleteTargetsForColumn(filteredRows, markedForDelete, deleteDialogColumn);
  }, [deleteDialogColumn, filteredRows, markedForDelete]);

  const deleteDialogFolderCount = useMemo(
    () => countDistinctParentFolders(deleteDialogTargets.map((t) => t.sourcePath)),
    [deleteDialogTargets],
  );
  const deleteDialogByteTotal = useMemo(
    () => sumByteSizesForPaths(filteredRows, deleteDialogTargets),
    [filteredRows, deleteDialogTargets],
  );

  const handleToggleMarkForDelete = useCallback((key: string, next: boolean) => {
    setMarkedForDelete((prev) => {
      const copy = new Set(prev);
      if (next) {
        copy.add(key);
      } else {
        copy.delete(key);
      }
      return copy;
    });
  }, []);

  const handleSelectAllScopedOnPage = useCallback(() => {
    setMarkedForDelete((prev) => {
      const keys = pageMarkKeys.scoped;
      const allOn = keys.length > 0 && keys.every((k) => prev.has(k));
      const next = new Set(prev);
      if (allOn) {
        keys.forEach((k) => {
          next.delete(k);
        });
      } else {
        keys.forEach((k) => {
          next.add(k);
        });
      }
      return next;
    });
  }, [pageMarkKeys.scoped]);

  const handleSelectAllDupOnPage = useCallback(() => {
    setMarkedForDelete((prev) => {
      const keys = pageMarkKeys.dup;
      const allOn = keys.length > 0 && keys.every((k) => prev.has(k));
      const next = new Set(prev);
      if (allOn) {
        keys.forEach((k) => {
          next.delete(k);
        });
      } else {
        keys.forEach((k) => {
          next.add(k);
        });
      }
      return next;
    });
  }, [pageMarkKeys.dup]);

  const handleClearScopedOnPage = useCallback(() => {
    setMarkedForDelete((prev) => {
      const next = new Set(prev);
      pageMarkKeys.scoped.forEach((k) => {
        next.delete(k);
      });
      return next;
    });
  }, [pageMarkKeys.scoped]);

  const handleClearDupOnPage = useCallback(() => {
    setMarkedForDelete((prev) => {
      const next = new Set(prev);
      pageMarkKeys.dup.forEach((k) => {
        next.delete(k);
      });
      return next;
    });
  }, [pageMarkKeys.dup]);

  useEffect(() => {
    onPageChange(0);
  }, [viewMode, filterFolder, onPageChange]);

  const summaryParts = useMemo(() => {
    const parts: string[] = [];
    const large = payload.skippedLargeFileCount;
    const missingDisk = payload.skippedMissingOnDiskCount;
    const totalUnresolved = payload.skippedMissingContentHashCount;
    const noFingerprintElsewhere = Math.max(0, totalUnresolved - large - missingDisk);

    if (noFingerprintElsewhere > 0) {
      parts.push(
        `${noFingerprintElsewhere} file(s) miss metadata needed for hashing in the database — run a folder scan.`,
      );
    }
    if (missingDisk > 0) {
      parts.push(`${missingDisk} file(s) are missing on disk and were skipped for duplicate matching.`);
    }
    return parts;
  }, [payload]);

  const handleSelectFolderFromOverview = useCallback((folderPath: string, region: DuplicateFolderPickRegion) => {
    setFilterFolder(folderPath);
    setFilterFolderRegion(region);
    setViewMode("by-file");
  }, []);

  const handlePrimaryBack = useCallback(() => {
    if (viewMode === "by-file") {
      setFilterFolder(null);
      setFilterFolderRegion(null);
      setViewMode("by-folder");
      return;
    }
    onClose();
  }, [viewMode, onClose]);

  const primaryBackLabel = viewMode === "by-file" ? "Back to duplicate folders" : "Exit duplicates view";

  const handleRequestDeleteColumn = useCallback(
    (column: DuplicateDeleteColumn) => {
      if (deleteInProgress) {
        return;
      }
      const targets = collectDuplicateDeleteTargetsForColumn(filteredRows, markedForDelete, column);
      if (targets.length === 0) {
        return;
      }
      setDeleteDialogColumn(column);
    },
    [deleteInProgress, filteredRows, markedForDelete],
  );

  const handleCancelDeleteDialog = useCallback(() => {
    if (!deleteSubmitting) {
      setDeleteDialogColumn(null);
    }
  }, [deleteSubmitting]);

  const handleConfirmDeleteDialog = useCallback(
    (useTrash: boolean) => {
      const column = deleteDialogColumn;
      if (column == null) {
        return;
      }
      void (async () => {
        const targets = collectDuplicateDeleteTargetsForColumn(filteredRows, markedForDelete, column);
        if (targets.length === 0) {
          setDeleteDialogColumn(null);
          return;
        }
        setDeleteSubmitting(true);
        try {
          const result = await enqueueDuplicateMarkedFilesDelete({
            targets,
            useTrash,
            displayName: `Delete duplicate files (${targets.length})`,
          });
          if (!result.ok) {
            window.alert(result.error);
            return;
          }
          setDeleteDialogColumn(null);
        } finally {
          setDeleteSubmitting(false);
        }
      })();
    },
    [deleteDialogColumn, filteredRows, markedForDelete],
  );

  const scopedSelectAllVisible =
    pageMarkKeys.scoped.length > 0 && !pageMarkKeys.scoped.every((k) => markedForDelete.has(k));
  const scopedClearAllVisible = pageMarkKeys.scoped.some((k) => markedForDelete.has(k));
  const dupSelectAllVisible =
    pageMarkKeys.dup.length > 0 && !pageMarkKeys.dup.every((k) => markedForDelete.has(k));
  const dupClearAllVisible = pageMarkKeys.dup.some((k) => markedForDelete.has(k));

  const byFileHasTable = viewMode === "by-file" && pageSliceFullList.length > 0;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted/40"
          onClick={handlePrimaryBack}
          aria-label={primaryBackLabel}
          title={primaryBackLabel}
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Back
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold leading-tight text-foreground">
            <span>Duplicates in folder</span>
            {payload.recursive ? (
              <span className="ml-1.5 align-middle text-sm font-normal text-muted-foreground">(with subfolders)</span>
            ) : null}
          </h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground" title={payload.folderPath}>
            {payload.folderPath}
          </p>
          {summaryParts.length > 0 ? (
            <div className="mt-1 space-y-1 text-xs text-amber-400/90">
              {summaryParts.map((line, i) => (
                <p key={i} className="leading-snug">
                  {line}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5">
            <button
              type="button"
              className={cn(
                "rounded px-3 py-1.5 text-sm transition-colors",
                viewMode === "by-folder" ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => {
                setFilterFolder(null);
                setFilterFolderRegion(null);
                setViewMode("by-folder");
              }}
            >
              By folder
            </button>
            <button
              type="button"
              className={cn(
                "rounded px-3 py-1.5 text-sm transition-colors",
                viewMode === "by-file" ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setViewMode("by-file")}
            >
              By file
            </button>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-auto px-4",
          byFileHasTable ? "pb-3 pt-0" : viewMode === "by-folder" ? "pt-3 pb-14" : "py-3",
        )}
      >
        {viewMode === "by-folder" ? (
          <DuplicateFilesByFolderPanel
            outsideSummaries={outsideSummaries}
            insideSummaries={insideSummaries}
            folderMediaCounts={folderMediaCounts}
            hasSelectionSubfolders={hasSelectionSubfolders}
            onSelectFolder={handleSelectFolderFromOverview}
            selectionScopeMediaCount={selectionScopeMediaCount}
            scopedWithDuplicateOutsideCount={scopedWithDuplicateOutsideCount}
            outsideDuplicateBytesTotal={outsideDuplicateBytesTotal}
            scopedWithDuplicateInsideCount={scopedWithDuplicateInsideCount}
            insideDuplicateBytesTotal={insideDuplicateBytesTotal}
          />
        ) : pageSliceFullList.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {filteredRows.length === 0
              ? "No rows match the current filter."
              : "No duplicate files found for items in this folder with the same catalog hash (and on-disk hash when needed)."}
          </p>
        ) : (
          <>
            <div className="sticky top-0 z-10 -mx-4 border-b border-border bg-background px-4 py-2.5">
              <div className="hidden max-lg:block space-y-5">
                <div className="space-y-1.5">
                  <div className="text-base font-semibold uppercase tracking-wide text-primary">Selected folder</div>
                  <div className="break-all font-mono text-sm font-medium text-foreground">{selectedFolderSubheaderDisplay}</div>
                  <DupColumnToolbarRow
                    markedInColumn={scopedColumnTargets.length}
                    showSelectAll={scopedSelectAllVisible}
                    showClearAll={scopedClearAllVisible}
                    onSelectAll={handleSelectAllScopedOnPage}
                    onClearAll={handleClearScopedOnPage}
                    deleteDisabled={scopedColumnTargets.length === 0 || deleteInProgress}
                    onRequestDelete={() => {
                      handleRequestDeleteColumn("scoped");
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="text-base font-semibold uppercase tracking-wide text-primary">Folders with duplicates</div>
                  <div className="min-h-[1.25rem]">
                    <FoldersWithDupHeaderLine text={foldersWithDupSubheaderText} />
                  </div>
                  <DupColumnToolbarRow
                    markedInColumn={dupColumnTargets.length}
                    showSelectAll={dupSelectAllVisible}
                    showClearAll={dupClearAllVisible}
                    onSelectAll={handleSelectAllDupOnPage}
                    onClearAll={handleClearDupOnPage}
                    deleteDisabled={dupColumnTargets.length === 0 || deleteInProgress}
                    onRequestDelete={() => {
                      handleRequestDeleteColumn("dup");
                    }}
                  />
                </div>
              </div>

              <div className="max-lg:hidden grid grid-cols-[144px_1fr_1fr] gap-x-3 gap-y-2">
                <div className="row-span-3" aria-hidden="true" />
                <div className="text-base font-semibold uppercase tracking-wide text-primary">Selected folder</div>
                <div className="text-base font-semibold uppercase tracking-wide text-primary">Folders with duplicates</div>

                <div className="min-w-0 break-all font-mono text-sm font-medium text-foreground">{selectedFolderSubheaderDisplay}</div>
                <div className="min-w-0">
                  <FoldersWithDupHeaderLine text={foldersWithDupSubheaderText} />
                </div>

                <DupColumnToolbarRow
                  markedInColumn={scopedColumnTargets.length}
                  showSelectAll={scopedSelectAllVisible}
                  showClearAll={scopedClearAllVisible}
                  onSelectAll={handleSelectAllScopedOnPage}
                  onClearAll={handleClearScopedOnPage}
                  deleteDisabled={scopedColumnTargets.length === 0 || deleteInProgress}
                  onRequestDelete={() => {
                    handleRequestDeleteColumn("scoped");
                  }}
                />
                <DupColumnToolbarRow
                  markedInColumn={dupColumnTargets.length}
                  showSelectAll={dupSelectAllVisible}
                  showClearAll={dupClearAllVisible}
                  onSelectAll={handleSelectAllDupOnPage}
                  onClearAll={handleClearDupOnPage}
                  deleteDisabled={dupColumnTargets.length === 0 || deleteInProgress}
                  onRequestDelete={() => {
                    handleRequestDeleteColumn("dup");
                  }}
                />
              </div>
            </div>
            <div className="mt-4 grid gap-4">
              {pageSliceFullList.map((row: FolderDuplicateScanRow) => (
                <DuplicateResultRow
                  key={row.mediaItemId}
                  row={row}
                  dateFormat={dateFormat}
                  scanRootComparable={selectedColumnRootComparable}
                  pathStyle={pathStyle}
                  markedForDelete={markedForDelete}
                  onToggleMark={handleToggleMarkForDelete}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {viewMode === "by-file" ? (
        <div className="shrink-0 border-t border-border px-4 py-3">
          <PeoplePaginationBar
            ariaLabel="Duplicate files pagination"
            currentPage={currentPage}
            totalItems={paginationTotal}
            pageSize={ALBUM_ITEMS_PAGE_SIZE}
            onPageChange={onPageChange}
          />
        </div>
      ) : null}
      <DuplicateFilesDeleteConfirmDialog
        open={deleteDialogColumn != null}
        fileCount={deleteDialogTargets.length}
        folderCount={deleteDialogFolderCount}
        totalBytes={deleteDialogByteTotal}
        isBusy={deleteSubmitting}
        onConfirm={handleConfirmDeleteDialog}
        onCancel={handleCancelDeleteDialog}
      />
    </div>
  );
}

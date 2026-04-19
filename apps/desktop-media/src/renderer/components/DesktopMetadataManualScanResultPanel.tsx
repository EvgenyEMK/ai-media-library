import {
  useCallback,
  useEffect,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { ChevronDown, X } from "lucide-react";
import { useDesktopStore, useDesktopStoreApi } from "../stores/desktop-store";
import { UI_TEXT } from "../lib/ui-text";
import { refreshFolderAnalysisStatuses } from "../hooks/ipc-binding-helpers";
import type { DesktopPipelineHandlers } from "../hooks/use-desktop-pipeline-handlers";
import { DesktopMetadataScanFollowUpBar } from "./DesktopMetadataScanFollowUpBar";

const ROW_CAP = 50;

type GroupId = "created" | "updated" | "moves" | "deleted" | "failed";

function visibleSlice<T>(items: T[], showAll: boolean): T[] {
  if (showAll || items.length <= ROW_CAP) {
    return items;
  }
  return items.slice(0, ROW_CAP);
}

function CollapsibleFileGroup(props: {
  title: string;
  count: number;
  showAllForGroup: boolean;
  onToggleShowAll: () => void;
  children: ReactNode;
}): ReactElement {
  const { title, count, showAllForGroup, onToggleShowAll, children } = props;
  return (
    <details className="rounded-md border border-border bg-card/30 [&[open]>summary_.chev-icon]:rotate-180">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium marker:content-none [&::-webkit-details-marker]:hidden">
        <ChevronDown
          className="chev-icon size-4 shrink-0 text-muted-foreground transition-transform"
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          {title} <span className="text-muted-foreground">({count})</span>
        </span>
      </summary>
      <div className="border-t border-border px-3 py-2">
        {children}
        {count > ROW_CAP ? (
          <button
            type="button"
            className="mt-2 text-xs text-primary hover:underline"
            onClick={onToggleShowAll}
          >
            {showAllForGroup ? UI_TEXT.metadataManualScanShowLess : UI_TEXT.metadataManualScanShowAll}{" "}
            ({count})
          </button>
        ) : null}
      </div>
    </details>
  );
}

interface DesktopMetadataManualScanResultPanelProps {
  pipeline: DesktopPipelineHandlers;
}

export function DesktopMetadataManualScanResultPanel({
  pipeline,
}: DesktopMetadataManualScanResultPanelProps): ReactElement | null {
  const payload = useDesktopStore((s) => s.metadataManualScanResult);
  const store = useDesktopStoreApi();
  const [showAllByGroup, setShowAllByGroup] = useState<Partial<Record<GroupId, boolean>>>({});
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    setShowAllByGroup({});
  }, [payload?.jobId]);

  const dismiss = useCallback(() => {
    store.getState().setMetadataManualScanResult(null);
  }, [store]);

  useEffect(() => {
    if (!payload) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [payload, dismiss]);

  const onPurgeDeleted = useCallback(async () => {
    if (!payload?.filesDeleted.length) return;
    if (!window.confirm(UI_TEXT.metadataManualScanPurgeConfirm)) return;
    setPurging(true);
    try {
      const ids = payload.filesDeleted.map((f) => f.id);
      await window.desktopApi.purgeSoftDeletedMediaItemsByIds(ids);
      const paths = new Set(payload.filesDeleted.map((f) => f.sourcePath));
      store.setState((s) => {
        s.mediaItems = s.mediaItems.filter((m) => !paths.has(m.id));
        const next = { ...s.mediaMetadataByItemId };
        for (const p of paths) {
          delete next[p];
        }
        s.mediaMetadataByItemId = next;
      });
      void refreshFolderAnalysisStatuses(store);
      dismiss();
    } catch {
      // best-effort
    } finally {
      setPurging(false);
    }
  }, [payload, store, dismiss]);

  const toggleShowAll = useCallback((id: GroupId) => {
    setShowAllByGroup((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  if (!payload) {
    return null;
  }

  const folderLabel = payload.folderPath.split(/[/\\]/).pop() ?? payload.folderPath;

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background"
      role="region"
      aria-labelledby="metadata-manual-scan-title"
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <h2 id="metadata-manual-scan-title" className="text-sm font-semibold">
            {UI_TEXT.metadataManualScanResultTitle}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {folderLabel}
            {payload.recursive ? ` · ${UI_TEXT.metadataManualScanRecursiveHint}` : ""}
          </p>
          {payload.scanCancelled ? (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              {UI_TEXT.metadataManualScanCancelledHint}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="border-0 bg-transparent p-1 text-muted-foreground shadow-none hover:text-foreground"
          title={UI_TEXT.metadataManualScanResultClose}
          aria-label={UI_TEXT.metadataManualScanResultClose}
          onClick={dismiss}
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <DesktopMetadataScanFollowUpBar layout="panel" pipeline={pipeline} />

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {payload.filesCreated.length > 0 ? (
          <CollapsibleFileGroup
            title={UI_TEXT.metadataManualScanGroupNew}
            count={payload.filesCreated.length}
            showAllForGroup={showAllByGroup.created === true}
            onToggleShowAll={() => toggleShowAll("created")}
          >
            <ul className="space-y-1 text-xs">
              {visibleSlice(payload.filesCreated, showAllByGroup.created === true).map((f) => (
                <li key={f.path} className="break-all font-mono text-muted-foreground">
                  {f.path}
                </li>
              ))}
            </ul>
          </CollapsibleFileGroup>
        ) : null}

        {payload.filesUpdated.length > 0 ? (
          <CollapsibleFileGroup
            title={UI_TEXT.metadataManualScanGroupUpdated}
            count={payload.filesUpdated.length}
            showAllForGroup={showAllByGroup.updated === true}
            onToggleShowAll={() => toggleShowAll("updated")}
          >
            <ul className="space-y-1 text-xs">
              {visibleSlice(payload.filesUpdated, showAllByGroup.updated === true).map((f) => (
                <li key={f.path} className="break-all font-mono text-muted-foreground">
                  {f.path}
                </li>
              ))}
            </ul>
          </CollapsibleFileGroup>
        ) : null}

        {payload.pathMoves.length > 0 ? (
          <CollapsibleFileGroup
            title={UI_TEXT.metadataManualScanGroupMoved}
            count={payload.pathMoves.length}
            showAllForGroup={showAllByGroup.moves === true}
            onToggleShowAll={() => toggleShowAll("moves")}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="max-w-[50%] py-1.5 pr-3 align-bottom font-medium">
                      {UI_TEXT.metadataManualScanPathColumnPrevious}
                    </th>
                    <th className="max-w-[50%] py-1.5 pl-3 align-bottom font-medium">
                      {UI_TEXT.metadataManualScanPathColumnNew}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSlice(payload.pathMoves, showAllByGroup.moves === true).map((m, i) => (
                    <tr key={`${m.previousPath}->${m.newPath}-${i}`} className="border-b border-border/60 align-top">
                      <td className="py-1.5 pr-3 font-mono text-muted-foreground break-all">
                        {m.previousPath}
                      </td>
                      <td className="py-1.5 pl-3 font-mono text-muted-foreground break-all">
                        {m.newPath}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleFileGroup>
        ) : null}

        {payload.filesDeleted.length > 0 ? (
          <CollapsibleFileGroup
            title={UI_TEXT.metadataManualScanGroupDeleted}
            count={payload.filesDeleted.length}
            showAllForGroup={showAllByGroup.deleted === true}
            onToggleShowAll={() => toggleShowAll("deleted")}
          >
            <ul className="space-y-1 text-xs">
              {visibleSlice(payload.filesDeleted, showAllByGroup.deleted === true).map((f) => (
                <li key={f.id} className="break-all font-mono text-muted-foreground">
                  {f.sourcePath}
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={purging}
              className="mt-3 rounded-md bg-destructive/90 px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive disabled:opacity-50"
              onClick={() => void onPurgeDeleted()}
            >
              {purging ? UI_TEXT.metadataManualScanPurgeWorking : UI_TEXT.metadataManualScanPurgeDeleted}
            </button>
          </CollapsibleFileGroup>
        ) : null}

        {payload.filesFailed.length > 0 ? (
          <CollapsibleFileGroup
            title={UI_TEXT.metadataManualScanGroupFailed}
            count={payload.filesFailed.length}
            showAllForGroup={showAllByGroup.failed === true}
            onToggleShowAll={() => toggleShowAll("failed")}
          >
            <ul className="space-y-2 text-xs">
              {visibleSlice(payload.filesFailed, showAllByGroup.failed === true).map((f) => (
                <li key={f.path} className="break-all font-mono text-muted-foreground">
                  <div className="text-foreground/90">{f.path}</div>
                  {f.error ? <div className="text-destructive/90">{f.error}</div> : null}
                </li>
              ))}
            </ul>
          </CollapsibleFileGroup>
        ) : null}
      </div>
    </div>
  );
}

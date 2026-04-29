import { type Dispatch, type ReactElement, type RefObject, type SetStateAction } from "react";
import { ArrowLeft, Filter, Grid3X3, List, Plus, RefreshCw, Search, Shuffle, Undo2 } from "lucide-react";
import type { ThumbnailQuickFilterState } from "@emk/media-metadata-core";
import type { DesktopStore } from "../stores/desktop-store";
import { Input } from "./ui/input";
import { QuickFiltersMenu } from "./QuickFiltersMenu";
import { ToolbarIconButton } from "./ToolbarIconButton";

export function DesktopAlbumsWorkspaceHeader({
  showingSmart,
  showingDetail,
  showingCreate,
  activeSmartTitle,
  selectedAlbumTitle,
  activeSmartAlbumKind,
  smartAlbumRootKind,
  smartFiltersOpen,
  smartFiltersActiveCount,
  onSmartFiltersOpenChange,
  randomizeEnabled,
  onRandomizeEnabledChange,
  onRandomizeRefresh,
  onBackToSmartRoot,
  onBackToList,
  onModeChange,
  newTitle,
  onNewTitleChange,
  onCreate,
  searchControlsOpen,
  onSearchControlsOpenChange,
  store,
  viewMode,
  albumQuickFiltersOpen,
  onAlbumQuickFiltersOpenChange,
  albumQuickFiltersActiveCount,
  albumQuickFilters,
  onAlbumQuickFiltersChange,
  quickFiltersMenuWrapRef,
}: {
  showingSmart: boolean;
  showingDetail: boolean;
  showingCreate: boolean;
  activeSmartTitle: string;
  selectedAlbumTitle: string | null;
  activeSmartAlbumKind: "place" | "best-of-year" | null;
  smartAlbumRootKind: string;
  smartFiltersOpen: boolean;
  smartFiltersActiveCount: number;
  onSmartFiltersOpenChange: (open: boolean) => void;
  randomizeEnabled: boolean;
  onRandomizeEnabledChange: (enabled: boolean) => void;
  onRandomizeRefresh: () => void;
  onBackToSmartRoot: () => void;
  onBackToList: () => void;
  onModeChange: (mode: "list" | "create" | "detail" | "smart") => void;
  newTitle: string;
  onNewTitleChange: (value: string) => void;
  onCreate: () => void;
  searchControlsOpen: boolean;
  onSearchControlsOpenChange: (open: boolean) => void;
  store: DesktopStore;
  viewMode: "grid" | "list";
  albumQuickFiltersOpen: boolean;
  onAlbumQuickFiltersOpenChange: (open: boolean) => void;
  albumQuickFiltersActiveCount: number;
  albumQuickFilters: ThumbnailQuickFilterState;
  onAlbumQuickFiltersChange: Dispatch<SetStateAction<ThumbnailQuickFilterState>>;
  quickFiltersMenuWrapRef: RefObject<HTMLDivElement | null>;
}): ReactElement {
  return (
    <div className="border-b border-border bg-card/90 p-4 backdrop-blur">
      {showingSmart ? (
        <div className="flex min-w-0 items-center gap-2">
          {activeSmartAlbumKind ? (
            <button
              type="button"
              onClick={onBackToSmartRoot}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted"
              aria-label="Back to smart albums"
              title="Back to smart albums"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
          ) : null}
          <div className="mr-auto min-w-0">
            <h1 className="truncate text-xl font-semibold">{activeSmartTitle}</h1>
            <p className="text-sm text-muted-foreground">
              {activeSmartAlbumKind
                ? "Dynamic album generated from library metadata."
                : "Smart albums generated from dates, places, ratings, and AI metadata."}
            </p>
          </div>
          {smartAlbumRootKind === "best-of-year" || smartAlbumRootKind === "country-area-city" ? (
            <div className="flex items-center gap-2">
              <ToolbarIconButton
                title={smartFiltersOpen ? "Hide filters" : "Show filters"}
                ariaExpanded={smartFiltersOpen}
                ariaPressed={smartFiltersActiveCount > 0}
                isActive={smartFiltersOpen || smartFiltersActiveCount > 0}
                badgeCount={smartFiltersActiveCount}
                onClick={() => onSmartFiltersOpenChange(!smartFiltersOpen)}
              >
                <Filter size={16} aria-hidden="true" />
              </ToolbarIconButton>
              {smartAlbumRootKind === "best-of-year" && activeSmartAlbumKind === "best-of-year" ? (
                <>
                  <button
                    type="button"
                    onClick={() => onRandomizeEnabledChange(!randomizeEnabled)}
                    className={`inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted ${
                      randomizeEnabled ? "bg-primary/10 text-foreground" : ""
                    }`}
                    aria-pressed={randomizeEnabled}
                  >
                    <Shuffle size={16} aria-hidden="true" />
                    Randomize
                  </button>
                  <button
                    type="button"
                    onClick={onRandomizeRefresh}
                    className="inline-flex size-9 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-50"
                    aria-label="Refresh randomized order"
                    title="Refresh randomized order"
                    disabled={!randomizeEnabled}
                  >
                    <RefreshCw size={16} aria-hidden="true" />
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : showingDetail && selectedAlbumTitle ? (
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onBackToList}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted"
            aria-label="Back to albums"
            title="Back to albums"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <h1 className="mr-auto min-w-0 truncate text-xl font-semibold">{selectedAlbumTitle}</h1>
          <div className="relative flex gap-2" ref={quickFiltersMenuWrapRef}>
            <ToolbarIconButton
              title={albumQuickFiltersOpen ? "Close filters" : "Open filters"}
              ariaExpanded={albumQuickFiltersOpen}
              ariaPressed={albumQuickFiltersActiveCount > 0}
              isActive={albumQuickFiltersActiveCount > 0}
              badgeCount={albumQuickFiltersActiveCount}
              onClick={() => onAlbumQuickFiltersOpenChange(!albumQuickFiltersOpen)}
            >
              <Filter size={16} aria-hidden="true" />
            </ToolbarIconButton>
            <QuickFiltersMenu
              isOpen={albumQuickFiltersOpen}
              filters={albumQuickFilters}
              onFiltersChange={onAlbumQuickFiltersChange}
              placementClassName="fixed right-4 top-16 max-h-[calc(100vh-5rem)] overflow-auto"
            />
            <ToolbarIconButton
              title="Grid view"
              ariaPressed={viewMode === "grid"}
              isActive={viewMode === "grid"}
              onClick={() => store.getState().setViewMode("grid")}
            >
              <Grid3X3 size={16} aria-hidden="true" />
            </ToolbarIconButton>
            <ToolbarIconButton
              title="List view"
              ariaPressed={viewMode === "list"}
              isActive={viewMode === "list"}
              onClick={() => store.getState().setViewMode("list")}
            >
              <List size={16} aria-hidden="true" />
            </ToolbarIconButton>
          </div>
        </div>
      ) : showingCreate ? (
        <div className="space-y-3">
          <h1 className="text-xl font-semibold">Albums</h1>
          <div className="flex max-w-xl flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onModeChange("list")}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted"
              aria-label="Back to albums"
              title="Back to albums"
            >
              <Undo2 size={18} aria-hidden="true" />
            </button>
            <Input
              value={newTitle}
              onChange={(event) => onNewTitleChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onCreate();
              }}
              placeholder="New album title"
              className="h-9 min-w-0 flex-1"
            />
            <button
              type="button"
              onClick={onCreate}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              Create
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="mr-auto text-xl font-semibold">Albums</h1>
          <button
            type="button"
            onClick={() => onSearchControlsOpenChange(!searchControlsOpen)}
            className={`inline-flex size-9 items-center justify-center rounded-md border border-border hover:bg-muted ${
              searchControlsOpen ? "bg-primary/10 text-foreground" : ""
            }`}
            aria-label={searchControlsOpen ? "Hide album search" : "Show album search"}
            title={searchControlsOpen ? "Hide album search" : "Show album search"}
          >
            <Search size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              store.getState().selectAlbum(null);
              onModeChange("create");
            }}
            className="inline-flex size-9 items-center justify-center rounded-md border border-border hover:bg-muted"
            aria-label="Create album"
            title="Create album"
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

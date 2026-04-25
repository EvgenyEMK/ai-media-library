import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { ArrowLeft, Filter, Grid3X3, List, Plus, Search, Undo2 } from "lucide-react";
import {
  DEFAULT_THUMBNAIL_QUICK_FILTERS,
  countActiveQuickFilters,
  type ThumbnailQuickFilterState,
} from "@emk/media-metadata-core";
import type { AlbumMediaItem } from "@emk/shared-contracts";
import type { DesktopPersonTagWithFaceCount } from "../../shared/ipc";
import { createDesktopAlbumActions } from "../actions/album-actions";
import { PeoplePaginationBar } from "./people-pagination-bar";
import { SemanticSearchPersonTagsBar } from "./semantic-search-person-tags-bar";
import type { PersonTagListMeta } from "../lib/tagged-faces-tab-visible-tags";
import { Input } from "./ui/input";
import { useDesktopStore, useDesktopStoreApi } from "../stores/desktop-store";
import type { AlbumWorkspaceMode } from "../types/app-types";
import { DesktopAlbumCard } from "./DesktopAlbumCard";
import { DesktopAlbumContentGrid } from "./DesktopAlbumContentGrid";
import { ALBUM_ITEMS_PAGE_SIZE } from "./DesktopAlbumDetailPanel";
import { QuickFiltersMenu } from "./QuickFiltersMenu";
import { ToolbarIconButton } from "./ToolbarIconButton";

const ALBUM_PAGE_SIZE = 24;

interface DesktopAlbumsWorkspaceProps {
  mode: AlbumWorkspaceMode;
  onModeChange: (mode: AlbumWorkspaceMode) => void;
  searchControlsOpen: boolean;
  onSearchControlsOpenChange: (open: boolean) => void;
}

export function DesktopAlbumsWorkspace({
  mode,
  onModeChange,
  searchControlsOpen,
  onSearchControlsOpenChange,
}: DesktopAlbumsWorkspaceProps): ReactElement {
  const store = useDesktopStoreApi();
  const albums = useDesktopStore((s) => s.albums);
  const selectedAlbumId = useDesktopStore((s) => s.selectedAlbumId);
  const viewMode = useDesktopStore((s) => s.viewMode);
  const actions = useMemo(() => createDesktopAlbumActions(store), [store]);
  const quickFiltersMenuWrapRef = useRef<HTMLDivElement>(null);

  const [titleQuery, setTitleQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [yearMonthFrom, setYearMonthFrom] = useState("");
  const [yearMonthTo, setYearMonthTo] = useState("");
  const [personTagIds, setPersonTagIds] = useState<string[]>([]);
  const [personTags, setPersonTags] = useState<PersonTagListMeta[]>([]);
  const [albumPage, setAlbumPage] = useState(0);
  const [albumTotal, setAlbumTotal] = useState(0);
  const [albumItemsPage, setAlbumItemsPage] = useState(0);
  const [albumItems, setAlbumItems] = useState<AlbumMediaItem[]>([]);
  const [albumItemsTotal, setAlbumItemsTotal] = useState(0);
  const [newTitle, setNewTitle] = useState("");
  const [albumQuickFilters, setAlbumQuickFilters] = useState<ThumbnailQuickFilterState>(
    DEFAULT_THUMBNAIL_QUICK_FILTERS,
  );
  const [albumQuickFiltersOpen, setAlbumQuickFiltersOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedAlbum = albums.find((album) => album.id === selectedAlbumId) ?? null;
  const personTagKey = personTagIds.join("|");
  const showingCreate = mode === "create";
  const showingDetail = mode === "detail" && selectedAlbum !== null;
  const albumQuickFiltersActiveCount = useMemo(
    () => countActiveQuickFilters(albumQuickFilters),
    [albumQuickFilters],
  );

  const loadAlbums = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await actions.loadAlbums({
        offset: albumPage * ALBUM_PAGE_SIZE,
        limit: ALBUM_PAGE_SIZE,
        titleQuery,
        locationQuery,
        yearMonthFrom,
        yearMonthTo,
        personTagIds,
      });
      setAlbumTotal(result.totalCount);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load albums.");
    } finally {
      setIsLoading(false);
    }
  }, [actions, albumPage, locationQuery, personTagIds, titleQuery, yearMonthFrom, yearMonthTo]);

  const loadAlbumItems = useCallback(async () => {
    if (!selectedAlbumId) {
      setAlbumItems([]);
      setAlbumItemsTotal(0);
      return;
    }
    const result = await actions.loadAlbumItems({
      albumId: selectedAlbumId,
      offset: albumItemsPage * ALBUM_ITEMS_PAGE_SIZE,
      limit: ALBUM_ITEMS_PAGE_SIZE,
    });
    setAlbumItems(result.rows);
    setAlbumItemsTotal(result.totalCount);
  }, [actions, albumItemsPage, selectedAlbumId]);
  const refreshAlbumDetailState = useCallback((): void => {
    void Promise.all([loadAlbumItems(), loadAlbums()]).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load album items.");
    });
  }, [loadAlbumItems, loadAlbums]);

  useEffect(() => {
    void window.desktopApi.listPersonTagsWithFaceCounts().then((tags: DesktopPersonTagWithFaceCount[]) => {
      setPersonTags(
        tags.map((tag) => ({
          id: tag.id,
          label: tag.label,
          pinned: tag.pinned,
          taggedFaceCount: tag.taggedFaceCount,
        })),
      );
    });
  }, []);

  useEffect(() => {
    void loadAlbums();
  }, [loadAlbums, personTagKey]);

  useEffect(() => {
    void loadAlbumItems().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load album items.");
    });
  }, [loadAlbumItems]);

  useEffect(() => {
    setAlbumPage(0);
  }, [titleQuery, locationQuery, yearMonthFrom, yearMonthTo, personTagKey]);

  useEffect(() => {
    setAlbumItemsPage(0);
  }, [selectedAlbum?.id]);

  useEffect(() => {
    if (!albumQuickFiltersOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent): void => {
      const targetNode = event.target as Node | null;
      if (!targetNode || quickFiltersMenuWrapRef.current?.contains(targetNode)) {
        return;
      }
      setAlbumQuickFiltersOpen(false);
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [albumQuickFiltersOpen]);

  const togglePersonTag = (tagId: string): void => {
    setPersonTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
    );
  };

  const handleCreate = async (): Promise<void> => {
    const title = newTitle.trim();
    if (!title) return;
    setErrorMessage(null);
    try {
      await actions.createAlbum(title);
      setNewTitle("");
      await loadAlbums();
      onModeChange("detail");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create album.");
    }
  };

  const handleBackToList = (): void => {
    store.getState().selectAlbum(null);
    onModeChange("list");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-border bg-card/60 p-4">
        {showingDetail ? (
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={handleBackToList}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted"
              aria-label="Back to albums"
              title="Back to albums"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <h1 className="mr-auto min-w-0 truncate text-xl font-semibold">{selectedAlbum.title}</h1>
            <div className="relative flex gap-2" ref={quickFiltersMenuWrapRef}>
              <ToolbarIconButton
                title={albumQuickFiltersOpen ? "Close filters" : "Open filters"}
                ariaExpanded={albumQuickFiltersOpen}
                ariaPressed={albumQuickFiltersActiveCount > 0}
                isActive={albumQuickFiltersActiveCount > 0}
                badgeCount={albumQuickFiltersActiveCount}
                onClick={() => setAlbumQuickFiltersOpen((open) => !open)}
              >
                <Filter size={16} aria-hidden="true" />
              </ToolbarIconButton>
              <QuickFiltersMenu
                isOpen={albumQuickFiltersOpen}
                filters={albumQuickFilters}
                onFiltersChange={setAlbumQuickFilters}
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
                onChange={(event) => setNewTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleCreate();
                }}
                placeholder="New album title"
                className="h-9 min-w-0 flex-1"
              />
              <button
                type="button"
                onClick={() => void handleCreate()}
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                Create
              </button>
            </div>
          </div>
        ) : (
          <>
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
            {searchControlsOpen ? (
              <>
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-muted-foreground">Title</span>
                    <Input value={titleQuery} onChange={(event) => setTitleQuery(event.target.value)} placeholder="Album title" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-muted-foreground">Location</span>
                    <Input
                      value={locationQuery}
                      onChange={(event) => setLocationQuery(event.target.value)}
                      placeholder="Country or city"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-muted-foreground">From</span>
                    <Input value={yearMonthFrom} onChange={(event) => setYearMonthFrom(event.target.value)} placeholder="YYYY or YYYY-MM" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-muted-foreground">To</span>
                    <Input value={yearMonthTo} onChange={(event) => setYearMonthTo(event.target.value)} placeholder="YYYY or YYYY-MM" />
                  </label>
                </div>
                <div className="mt-3">
                  <SemanticSearchPersonTagsBar
                    tagsMeta={personTags}
                    selectedTagIds={personTagIds}
                    onToggleTag={togglePersonTag}
                  />
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
      {errorMessage ? (
        <div className="mx-4 mt-3 rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}
      {showingCreate ? null : showingDetail ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <DesktopAlbumContentGrid
            store={store}
            albumId={selectedAlbum.id}
            albumItems={albumItems}
            albumItemsPage={albumItemsPage}
            albumItemsTotal={albumItemsTotal}
            quickFilters={albumQuickFilters}
            viewMode={viewMode}
            onAlbumItemsPageChange={setAlbumItemsPage}
            onAlbumContentChanged={refreshAlbumDetailState}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {isLoading ? <div className="text-sm text-muted-foreground">Loading albums...</div> : null}
          {!isLoading && albums.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
              No albums match the current filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {albums.map((album) => (
                <DesktopAlbumCard
                  key={album.id}
                  album={album}
                  selected={album.id === selectedAlbumId}
                  onClick={() => {
                    store.getState().selectAlbum(album.id);
                    onModeChange("detail");
                  }}
                />
              ))}
            </div>
          )}
          <div className="mt-4">
            <PeoplePaginationBar
              ariaLabel="Albums pagination"
              currentPage={albumPage}
              totalItems={albumTotal}
              pageSize={ALBUM_PAGE_SIZE}
              disabled={isLoading}
              onPageChange={setAlbumPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}

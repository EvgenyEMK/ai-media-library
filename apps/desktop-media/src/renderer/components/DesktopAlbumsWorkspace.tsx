import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { ArrowLeft, Filter, Grid3X3, List, Plus, Search, Shuffle, Undo2 } from "lucide-react";
import {
  DEFAULT_THUMBNAIL_QUICK_FILTERS,
  countActiveQuickFilters,
  type ThumbnailQuickFilterState,
} from "@emk/media-metadata-core";
import type {
  AlbumMediaItem,
  SmartAlbumPlaceCountry,
  SmartAlbumPlaceEntry,
  SmartAlbumPlacesRequest,
  SmartAlbumRootKind,
  SmartAlbumYearSummary,
} from "@emk/shared-contracts";
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
import { toFileUrl } from "./face-cluster-utils";

const ALBUM_PAGE_SIZE = 24;

interface DesktopAlbumsWorkspaceProps {
  mode: AlbumWorkspaceMode;
  onModeChange: (mode: AlbumWorkspaceMode) => void;
  smartAlbumRootKind: SmartAlbumRootKind;
  searchControlsOpen: boolean;
  onSearchControlsOpenChange: (open: boolean) => void;
}

type ActiveSmartAlbum =
  | {
      kind: "place";
      entry: SmartAlbumPlaceEntry;
    }
  | {
      kind: "best-of-year";
      year: string;
      randomize: boolean;
      refreshKey: number;
    }
  | null;

export function DesktopAlbumsWorkspace({
  mode,
  onModeChange,
  smartAlbumRootKind,
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
  const [smartPlaceCountries, setSmartPlaceCountries] = useState<SmartAlbumPlaceCountry[]>([]);
  const [smartYears, setSmartYears] = useState<SmartAlbumYearSummary[]>([]);
  const [selectedSmartCountry, setSelectedSmartCountry] = useState<string | null>(null);
  const [selectedSmartYear, setSelectedSmartYear] = useState<string | null>(null);
  const [activeSmartAlbum, setActiveSmartAlbum] = useState<ActiveSmartAlbum>(null);
  const [smartItemsPage, setSmartItemsPage] = useState(0);
  const [smartItems, setSmartItems] = useState<AlbumMediaItem[]>([]);
  const [smartItemsTotal, setSmartItemsTotal] = useState(0);
  const [newTitle, setNewTitle] = useState("");
  const [albumQuickFilters, setAlbumQuickFilters] = useState<ThumbnailQuickFilterState>(
    DEFAULT_THUMBNAIL_QUICK_FILTERS,
  );
  const [albumQuickFiltersOpen, setAlbumQuickFiltersOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedAlbum = albums.find((album) => album.id === selectedAlbumId) ?? null;
  const smartPlaceRequest = useMemo<SmartAlbumPlacesRequest | null>(
    () =>
      smartAlbumRootKind === "best-of-year"
        ? null
        : {
            grouping: smartAlbumRootKind === "country-area-city" ? "area-city" : "year-city",
            source: smartAlbumRootKind === "ai-countries" ? "non-gps" : "gps",
          },
    [smartAlbumRootKind],
  );
  const smartPlaceRootTitle =
    smartAlbumRootKind === "country-area-city"
      ? "Country > Area > City"
      : smartAlbumRootKind === "ai-countries"
        ? "AI countries"
        : "County > Year > City";
  const smartPlaceGroupLabel = smartPlaceRequest?.grouping === "area-city" ? "areas" : "years";
  const selectedSmartCountryGroup = selectedSmartCountry
    ? smartPlaceCountries.find((country) => country.country === selectedSmartCountry) ?? null
    : null;
  const selectedSmartYearGroup = selectedSmartCountryGroup && selectedSmartYear
    ? selectedSmartCountryGroup.groups.find((group) => group.group === selectedSmartYear) ?? null
    : null;
  const personTagKey = personTagIds.join("|");
  const showingCreate = mode === "create";
  const showingDetail = mode === "detail" && selectedAlbum !== null;
  const showingSmart = mode === "smart";
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

  const loadSmartRoots = useCallback(async () => {
    if (!showingSmart) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (smartPlaceRequest) {
        const result = await actions.loadSmartAlbumPlaces(smartPlaceRequest);
        setSmartPlaceCountries(result.countries);
      } else {
        const result = await actions.loadSmartAlbumYears();
        setSmartYears(result.years);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load smart albums.");
    } finally {
      setIsLoading(false);
    }
  }, [actions, showingSmart, smartAlbumRootKind, smartPlaceRequest]);

  const loadSmartAlbumItems = useCallback(async () => {
    if (!activeSmartAlbum) {
      setSmartItems([]);
      setSmartItemsTotal(0);
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = activeSmartAlbum.kind === "place"
        ? await actions.loadSmartAlbumItems({
            kind: "place",
            country: activeSmartAlbum.entry.country,
            city: activeSmartAlbum.entry.city,
            group: activeSmartAlbum.entry.group,
            grouping: smartPlaceRequest?.grouping ?? "year-city",
            source: smartPlaceRequest?.source ?? "gps",
            offset: smartItemsPage * ALBUM_ITEMS_PAGE_SIZE,
            limit: ALBUM_ITEMS_PAGE_SIZE,
          })
        : await actions.loadSmartAlbumItems({
            kind: "best-of-year",
            year: activeSmartAlbum.year,
            randomize: activeSmartAlbum.randomize,
            offset: smartItemsPage * ALBUM_ITEMS_PAGE_SIZE,
            limit: ALBUM_ITEMS_PAGE_SIZE,
          });
      setSmartItems(result.rows);
      setSmartItemsTotal(result.totalCount);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load smart album items.");
    } finally {
      setIsLoading(false);
    }
  }, [actions, activeSmartAlbum, smartItemsPage, smartPlaceRequest]);

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
    if (!showingSmart) {
      return;
    }
    setActiveSmartAlbum(null);
    setSelectedSmartCountry(null);
    setSelectedSmartYear(null);
    setSmartItemsPage(0);
    void loadSmartRoots();
  }, [loadSmartRoots, showingSmart, smartAlbumRootKind]);

  useEffect(() => {
    if (!showingSmart) {
      return;
    }
    void loadSmartAlbumItems();
  }, [loadSmartAlbumItems, showingSmart]);

  useEffect(() => {
    setAlbumPage(0);
  }, [titleQuery, locationQuery, yearMonthFrom, yearMonthTo, personTagKey]);

  useEffect(() => {
    setAlbumItemsPage(0);
  }, [selectedAlbum?.id]);

  useEffect(() => {
    setSmartItemsPage(0);
  }, [activeSmartAlbum]);

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

  const smartRootTitle = smartAlbumRootKind === "best-of-year" ? "Best of Year" : smartPlaceRootTitle;
  const activeSmartTitle = activeSmartAlbum?.kind === "place"
    ? `${activeSmartAlbum.entry.country} > ${activeSmartAlbum.entry.group} > ${activeSmartAlbum.entry.city}`
    : activeSmartAlbum?.kind === "best-of-year"
      ? `Best of ${activeSmartAlbum.year}`
      : selectedSmartCountry && selectedSmartYear
        ? `${smartPlaceRootTitle} > ${selectedSmartCountry} > ${selectedSmartYear}`
        : selectedSmartCountry
          ? `${smartPlaceRootTitle} > ${selectedSmartCountry}`
      : smartRootTitle;

  const handleBackToSmartRoot = (): void => {
    if (activeSmartAlbum) {
      setActiveSmartAlbum(null);
    } else if (selectedSmartYear) {
      setSelectedSmartYear(null);
    } else {
      setSelectedSmartCountry(null);
    }
    setSmartItemsPage(0);
  };

  const handleShuffleBestOfYear = (): void => {
    setActiveSmartAlbum((current) => {
      if (!current || current.kind !== "best-of-year") {
        return current;
      }
      return {
        ...current,
        randomize: true,
        refreshKey: Date.now(),
      };
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-border bg-card/60 p-4">
        {showingSmart ? (
          <div className="flex min-w-0 items-center gap-2">
            {activeSmartAlbum || selectedSmartCountry ? (
              <button
                type="button"
                onClick={handleBackToSmartRoot}
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
                {activeSmartAlbum
                  ? "Dynamic album generated from library metadata."
                  : "Smart albums generated from dates, places, ratings, and AI metadata."}
              </p>
            </div>
            {activeSmartAlbum?.kind === "best-of-year" ? (
              <button
                type="button"
                onClick={handleShuffleBestOfYear}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                <Shuffle size={16} aria-hidden="true" />
                Shuffle
              </button>
            ) : null}
          </div>
        ) : showingDetail ? (
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
      {showingSmart ? (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {isLoading ? <div className="text-sm text-muted-foreground">Loading smart albums...</div> : null}
          {!activeSmartAlbum ? (
            smartPlaceRequest ? (
              smartPlaceCountries.length === 0 && !isLoading ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                  {smartPlaceRequest.source === "gps"
                    ? "No GPS countries found yet. Run metadata scan with GPS location detection to generate country smart albums."
                    : "No non-GPS country-like locations found yet."}
                </div>
              ) : (
                <div className="space-y-4">
                  {!selectedSmartCountryGroup ? (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {smartPlaceCountries.map((country) => (
                        <button
                          key={country.country}
                          type="button"
                          onClick={() => {
                            setSelectedSmartCountry(country.country);
                            setSelectedSmartYear(null);
                          }}
                          className="rounded-lg border border-border bg-card/60 px-4 py-3 text-left hover:bg-muted"
                        >
                          <div className="font-semibold text-foreground">{country.country}</div>
                          <div className="text-sm text-muted-foreground">
                            {country.groups.length} {smartPlaceGroupLabel} · {country.mediaCount} items
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : !selectedSmartYearGroup ? (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {selectedSmartCountryGroup.groups.map((year) => (
                        <button
                          key={`${selectedSmartCountryGroup.country}-${year.group}`}
                          type="button"
                          onClick={() => setSelectedSmartYear(year.group)}
                          className="rounded-lg border border-border bg-card/60 px-4 py-3 text-left hover:bg-muted"
                        >
                          <div className="font-semibold text-foreground">{year.group}</div>
                          <div className="text-sm text-muted-foreground">
                            {year.entries.length} cities · {year.mediaCount} items
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {selectedSmartYearGroup.entries.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => setActiveSmartAlbum({ kind: "place", entry })}
                          className="rounded-lg border border-border bg-card/60 px-4 py-3 text-left hover:bg-muted"
                        >
                          <div className="font-semibold text-foreground">{entry.label}</div>
                          <div className="text-sm text-muted-foreground">{entry.mediaCount} items</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            ) : smartYears.length === 0 && !isLoading ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
                No dated media found yet. Run metadata scan to generate Best of Year smart albums.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {smartYears.map((year) => (
                  <button
                    key={year.year}
                    type="button"
                    onClick={() =>
                      setActiveSmartAlbum({
                        kind: "best-of-year",
                        year: year.year,
                        randomize: true,
                        refreshKey: Date.now(),
                      })
                    }
                    className="overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm hover:bg-muted/50"
                  >
                    {year.coverSourcePath ? (
                      <img
                        src={toFileUrl(year.coverSourcePath)}
                        alt={`Best of ${year.year}`}
                        className="aspect-video w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="aspect-video w-full bg-muted" />
                    )}
                    <div className="space-y-1 p-3">
                      <h2 className="font-semibold text-foreground">Best of {year.year}</h2>
                      <p className="text-sm text-muted-foreground">{year.mediaCount} items</p>
                      <p className="text-xs text-muted-foreground">
                        Top rating {year.topStarRating ?? "n/a"} · AI quality {year.topAestheticScore?.toFixed(1) ?? "n/a"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <DesktopAlbumContentGrid
              store={store}
              albumItems={smartItems}
              albumItemsPage={smartItemsPage}
              albumItemsTotal={smartItemsTotal}
              quickFilters={albumQuickFilters}
              viewMode={viewMode}
              onAlbumItemsPageChange={setSmartItemsPage}
            />
          )}
        </div>
      ) : showingCreate ? null : showingDetail ? (
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

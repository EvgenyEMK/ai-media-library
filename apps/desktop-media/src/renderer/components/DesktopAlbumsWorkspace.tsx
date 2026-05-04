import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { Loader2, X } from "lucide-react";
import {
  DEFAULT_THUMBNAIL_QUICK_FILTERS,
  countActiveQuickFilters,
  type ThumbnailQuickFilterState,
} from "@emk/media-metadata-core";
import type {
  AlbumMediaItem,
  SmartAlbumFilters,
  SmartAlbumPlaceEntry,
  SmartAlbumPlacesRequest,
  SmartAlbumRootKind,
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
import { BestOfYearFiltersPanel } from "./BestOfYearFiltersPanel";
import { DesktopAlbumsWorkspaceHeader } from "./DesktopAlbumsWorkspaceHeader";
import { SmartAlbumsWorkspace } from "./SmartAlbumsWorkspace";
import {
  ALBUM_LIST_LOCATION_INPUT_MAX_CLASS,
  ALBUM_LIST_SEARCH_FIELD_DEBOUNCE_MS,
  ALBUM_LIST_TITLE_INPUT_MAX_CLASS,
} from "../lib/album-list-search-ui";
import {
  ALBUM_YEAR_MONTH_INPUT_HINT,
  ALBUM_YEAR_MONTH_INPUT_PLACEHOLDER,
  sanitizeAlbumYearMonthDigitsInput,
} from "../lib/album-year-month-input";
import { EMPTY_SMART_ALBUM_FILTERS, smartAlbumSettingsToFilters, useSmartAlbums } from "./useSmartAlbums";

const ALBUM_PAGE_SIZE = 24;

function formatSmartAlbumPlaceAreaSegment(entry: Pick<SmartAlbumPlaceEntry, "group" | "groupParent">): string {
  return entry.groupParent ? `${entry.groupParent} - ${entry.group}` : entry.group;
}

function formatActiveSmartPlacePath(entry: SmartAlbumPlaceEntry): string {
  const parts = [entry.country];
  const area1 = entry.area1 ?? entry.groupParent ?? null;
  const area2 = entry.area2 ?? entry.group ?? null;
  const leafLevel = entry.leafLevel ?? "city";
  if (area1) {
    parts.push(area1);
  }
  if (leafLevel !== "area1" && area2 && (area2 !== area1 || leafLevel === "area2")) {
    parts.push(area2);
  }
  if (leafLevel === "city" && entry.city) {
    parts.push(entry.city);
  }
  if (parts.length === 1) {
    parts.push(formatSmartAlbumPlaceAreaSegment(entry), entry.label);
  }
  return parts.join(" > ");
}

function countActiveSmartAlbumFilters(filters: SmartAlbumFilters): number {
  let count = 0;
  if (filters.query?.trim()) count += 1;
  if ((filters.personTagIds ?? []).length > 0) count += 1;
  if (Number.isFinite(filters.starRatingMin)) count += 1;
  if (Number.isFinite(filters.aiAestheticMin)) count += 1;
  return count;
}

function smartAlbumFiltersEqual(left: SmartAlbumFilters, right: SmartAlbumFilters): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

interface DesktopAlbumsWorkspaceProps {
  mode: AlbumWorkspaceMode;
  onModeChange: (mode: AlbumWorkspaceMode) => void;
  smartAlbumRootKind: SmartAlbumRootKind;
  searchControlsOpen: boolean;
  onSearchControlsOpenChange: (open: boolean) => void;
}

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
  const smartAlbumSettings = useDesktopStore((s) => s.smartAlbumSettings);
  const actions = useMemo(() => createDesktopAlbumActions(store), [store]);
  const quickFiltersMenuWrapRef = useRef<HTMLDivElement>(null);
  const defaultSmartAlbumFilters = useMemo(
    () => smartAlbumSettingsToFilters(smartAlbumSettings),
    [smartAlbumSettings],
  );
  const previousDefaultSmartAlbumFiltersRef = useRef(defaultSmartAlbumFilters);
  const smartAlbums = useSmartAlbums(defaultSmartAlbumFilters);

  const [titleDraft, setTitleDraft] = useState("");
  const [locationDraft, setLocationDraft] = useState("");
  const [yearMonthFromDraft, setYearMonthFromDraft] = useState("");
  const [yearMonthToDraft, setYearMonthToDraft] = useState("");
  const [titleFilter, setTitleFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [yearMonthFromFilter, setYearMonthFromFilter] = useState("");
  const [yearMonthToFilter, setYearMonthToFilter] = useState("");
  const [personTagIds, setPersonTagIds] = useState<string[]>([]);
  const [includeUnconfirmedAlbumFaces, setIncludeUnconfirmedAlbumFaces] = useState(true);
  const [personTags, setPersonTags] = useState<PersonTagListMeta[]>([]);
  const [albumPage, setAlbumPage] = useState(0);
  const [albumTotal, setAlbumTotal] = useState(0);
  const [albumItemsPage, setAlbumItemsPage] = useState(0);
  const [albumItems, setAlbumItems] = useState<AlbumMediaItem[]>([]);
  const [albumItemsTotal, setAlbumItemsTotal] = useState(0);
  const {
    smartPlaceCountries,
    setSmartPlaceCountries,
    smartYears,
    setSmartYears,
    expandedSmartCountries,
    setExpandedSmartCountries,
    expandedSmartGroups,
    setExpandedSmartGroups,
    activeSmartAlbum,
    setActiveSmartAlbum,
    smartItemsPage,
    setSmartItemsPage,
    smartItems,
    setSmartItems,
    smartItemsTotal,
    setSmartItemsTotal,
    smartAlbumFilters,
    setSmartAlbumFilters,
    randomizeEnabled,
    setRandomizeEnabled,
    randomRefreshKey,
    refreshRandomOrder,
    randomCandidateLimit,
    smartPlaceHierarchyLevels,
    setSmartPlaceHierarchyLevels,
  } = smartAlbums;
  const smartAlbumFiltersForRpc = useMemo(
    (): SmartAlbumFilters => ({
      ...smartAlbumFilters,
      excludedImageCategories: smartAlbumSettings.excludedImageCategories,
    }),
    [smartAlbumFilters, smartAlbumSettings.excludedImageCategories],
  );
  const [newTitle, setNewTitle] = useState("");
  const [albumQuickFilters, setAlbumQuickFilters] = useState<ThumbnailQuickFilterState>(
    DEFAULT_THUMBNAIL_QUICK_FILTERS,
  );
  const [albumQuickFiltersOpen, setAlbumQuickFiltersOpen] = useState(false);
  const [smartFilterPanelOpen, setSmartFilterPanelOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const albumDateRangeFocusCleanupRef = useRef<(() => void) | null>(null);
  const [showAlbumDateRangeHint, setShowAlbumDateRangeHint] = useState(false);

  const albumDateRangeFieldShellRefCallback = useCallback((el: HTMLDivElement | null) => {
    albumDateRangeFocusCleanupRef.current?.();
    albumDateRangeFocusCleanupRef.current = null;
    if (!el) {
      setShowAlbumDateRangeHint(false);
      return;
    }
    if (!searchControlsOpen) {
      return;
    }
    const onFocusIn = (): void => {
      setShowAlbumDateRangeHint(true);
    };
    const onFocusOut = (event: FocusEvent): void => {
      const next = event.relatedTarget as Node | null;
      if (!next || !el.contains(next)) {
        setShowAlbumDateRangeHint(false);
      }
    };
    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    albumDateRangeFocusCleanupRef.current = (): void => {
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
    };
  }, [searchControlsOpen]);

  const selectedAlbum = albums.find((album) => album.id === selectedAlbumId) ?? null;
  const smartPlaceRequest = useMemo<SmartAlbumPlacesRequest | null>(
    () =>
      smartAlbumRootKind === "best-of-year"
        ? null
        : {
            grouping:
              smartAlbumRootKind === "country-area-city"
                ? "area-city"
                : smartAlbumRootKind === "country-month-area"
                  ? "month-area"
                  : "year-city",
            source: smartAlbumRootKind === "ai-countries" ? "non-gps" : "gps",
          },
    [smartAlbumRootKind],
  );
  const smartPlaceRootTitle =
    smartAlbumRootKind === "country-area-city"
      ? "Country > Area > City"
      : smartAlbumRootKind === "country-month-area"
        ? "Country > YYYY-MM Area"
      : smartAlbumRootKind === "ai-countries"
        ? "AI countries"
        : "Country > Year > Area";
  const smartPlaceGroupLabel =
    smartPlaceRequest?.grouping === "area-city"
      ? "areas"
      : smartPlaceRequest?.grouping === "month-area"
        ? "months"
        : "years";
  const smartPlaceEntryLabel =
    smartPlaceRequest?.grouping === "area-city"
      ? "cities"
      : smartPlaceRequest?.grouping === "month-area"
        ? "areas"
        : "areas";
  const personTagKey = personTagIds.join("|");
  const showingCreate = mode === "create";
  const showingDetail = mode === "detail" && selectedAlbum !== null;
  const showingSmart = mode === "smart";
  const albumQuickFiltersActiveCount = useMemo(
    () => countActiveQuickFilters(albumQuickFilters),
    [albumQuickFilters],
  );
  const smartFiltersActiveCount = useMemo(
    () => countActiveSmartAlbumFilters(smartAlbumFilters),
    [smartAlbumFilters],
  );
  const albumListSearchFiltersActiveCount = useMemo((): number => {
    let count = 0;
    if (titleDraft.trim() || titleFilter.trim()) count += 1;
    if (locationDraft.trim() || locationFilter.trim()) count += 1;
    if (yearMonthFromDraft.trim() || yearMonthFromFilter.trim()) count += 1;
    if (yearMonthToDraft.trim() || yearMonthToFilter.trim()) count += 1;
    if (personTagIds.length > 0) count += 1;
    if (personTagIds.length > 0 && !includeUnconfirmedAlbumFaces) count += 1;
    return count;
  }, [
    titleDraft,
    titleFilter,
    locationDraft,
    locationFilter,
    yearMonthFromDraft,
    yearMonthFromFilter,
    yearMonthToDraft,
    yearMonthToFilter,
    personTagIds,
    includeUnconfirmedAlbumFaces,
  ]);
  const showSmartFilterPanel = smartFilterPanelOpen;

  const loadAlbums = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await actions.loadAlbums({
        offset: albumPage * ALBUM_PAGE_SIZE,
        limit: ALBUM_PAGE_SIZE,
        titleQuery: titleFilter,
        locationQuery: locationFilter,
        yearMonthFrom: yearMonthFromFilter,
        yearMonthTo: yearMonthToFilter,
        personTagIds,
        includeUnconfirmedFaces:
          personTagIds.length > 0 ? includeUnconfirmedAlbumFaces : undefined,
      });
      setAlbumTotal(result.totalCount);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load albums.");
    } finally {
      setIsLoading(false);
    }
  }, [
    actions,
    albumPage,
    locationFilter,
    includeUnconfirmedAlbumFaces,
    personTagIds,
    titleFilter,
    yearMonthFromFilter,
    yearMonthToFilter,
  ]);

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
        const result = await actions.loadSmartAlbumPlaces({
          ...smartPlaceRequest,
          filters: smartAlbumFiltersForRpc,
        });
        setSmartPlaceCountries(result.countries);
      } else {
        const result = await actions.loadSmartAlbumYears({ filters: smartAlbumFiltersForRpc });
        setSmartYears(result.years);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load smart albums.");
    } finally {
      setIsLoading(false);
    }
  }, [actions, showingSmart, smartAlbumFiltersForRpc, smartPlaceRequest]);

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
            city: activeSmartAlbum.entry.leafLevel === "city" ? activeSmartAlbum.entry.city : null,
            group: activeSmartAlbum.entry.group,
            grouping: smartPlaceRequest?.grouping ?? "year-city",
            source: smartPlaceRequest?.source ?? "gps",
            leafLevel: activeSmartAlbum.entry.leafLevel ?? "city",
            area1: activeSmartAlbum.entry.area1 ?? activeSmartAlbum.entry.groupParent ?? null,
            area2: activeSmartAlbum.entry.area2 ?? activeSmartAlbum.entry.group ?? null,
            filters: smartAlbumFiltersForRpc,
            offset: smartItemsPage * ALBUM_ITEMS_PAGE_SIZE,
            limit: ALBUM_ITEMS_PAGE_SIZE,
          })
        : await actions.loadSmartAlbumItems({
            kind: "best-of-year",
            year: activeSmartAlbum.year,
            randomize: randomizeEnabled,
            randomCandidateLimit,
            filters: smartAlbumFiltersForRpc,
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
  }, [
    actions,
    activeSmartAlbum,
    randomCandidateLimit,
    randomizeEnabled,
    randomRefreshKey,
    smartAlbumFiltersForRpc,
    smartItemsPage,
    smartPlaceRequest,
  ]);

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
    const previousDefault = previousDefaultSmartAlbumFiltersRef.current;
    previousDefaultSmartAlbumFiltersRef.current = defaultSmartAlbumFilters;
    setSmartAlbumFilters((current) =>
      smartAlbumFiltersEqual(current, previousDefault) ? defaultSmartAlbumFilters : current,
    );
  }, [defaultSmartAlbumFilters, setSmartAlbumFilters]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setTitleFilter(titleDraft);
      setLocationFilter(locationDraft);
      setYearMonthFromFilter(yearMonthFromDraft);
      setYearMonthToFilter(yearMonthToDraft);
    }, ALBUM_LIST_SEARCH_FIELD_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [titleDraft, locationDraft, yearMonthFromDraft, yearMonthToDraft]);

  useEffect(() => {
    void loadAlbums();
  }, [loadAlbums, personTagKey, includeUnconfirmedAlbumFaces]);

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
    setExpandedSmartCountries([]);
    setExpandedSmartGroups([]);
    setSmartItemsPage(0);
    setSmartFilterPanelOpen(true);
    void loadSmartRoots();
  }, [showingSmart, smartAlbumRootKind]);

  useEffect(() => {
    if (!showingSmart) {
      return;
    }
    void loadSmartAlbumItems();
  }, [loadSmartAlbumItems, showingSmart]);

  useEffect(() => {
    if (!showingSmart || activeSmartAlbum) {
      return;
    }
    void loadSmartRoots();
  }, [activeSmartAlbum, loadSmartRoots, showingSmart, smartAlbumFiltersForRpc, smartPlaceRequest]);

  useLayoutEffect(() => {
    setAlbumPage(0);
  }, [
    titleFilter,
    locationFilter,
    yearMonthFromFilter,
    yearMonthToFilter,
    personTagKey,
    includeUnconfirmedAlbumFaces,
  ]);

  useEffect(() => {
    setAlbumItemsPage(0);
  }, [selectedAlbum?.id]);

  useEffect(() => {
    setSmartItemsPage(0);
  }, [activeSmartAlbum]);

  useEffect(() => {
    setSmartItemsPage(0);
  }, [smartAlbumFiltersForRpc]);

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

  const toggleSmartFilterPersonTag = (tagId: string): void => {
    setSmartAlbumFilters((current) => {
      const existing = current.personTagIds ?? [];
      const next = existing.includes(tagId)
        ? existing.filter((id) => id !== tagId)
        : [...existing, tagId];
      return { ...current, personTagIds: next };
    });
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
    ? formatActiveSmartPlacePath(activeSmartAlbum.entry)
    : activeSmartAlbum?.kind === "best-of-year"
      ? `Best of ${activeSmartAlbum.year}`
      : smartRootTitle;

  const handleBackToSmartRoot = (): void => {
    setActiveSmartAlbum(null);
    setSmartItemsPage(0);
  };

  const toggleSmartCountry = (country: string): void => {
    setExpandedSmartCountries((current) =>
      current.includes(country) ? current.filter((value) => value !== country) : [...current, country],
    );
  };

  const toggleSmartGroup = (country: string, group: string): void => {
    const key = `${country}::${group}`;
    setExpandedSmartGroups((current) =>
      current.includes(key) ? current.filter((value) => value !== key) : [...current, key],
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="sticky top-0 z-20">
        <DesktopAlbumsWorkspaceHeader
          showingSmart={showingSmart}
          showingDetail={showingDetail}
          showingCreate={showingCreate}
          activeSmartTitle={activeSmartTitle}
          selectedAlbumTitle={selectedAlbum?.title ?? null}
          activeSmartAlbumKind={activeSmartAlbum?.kind ?? null}
          smartAlbumRootKind={smartAlbumRootKind}
          smartFiltersOpen={showSmartFilterPanel}
          smartFiltersActiveCount={smartFiltersActiveCount}
          onSmartFiltersOpenChange={setSmartFilterPanelOpen}
          randomizeEnabled={randomizeEnabled}
          onRandomizeEnabledChange={(enabled) => {
            setRandomizeEnabled(enabled);
            setSmartItemsPage(0);
          }}
          onRandomizeRefresh={() => {
            setSmartItemsPage(0);
            refreshRandomOrder();
          }}
          onBackToSmartRoot={handleBackToSmartRoot}
          onBackToList={handleBackToList}
          onModeChange={onModeChange}
          newTitle={newTitle}
          onNewTitleChange={setNewTitle}
          onCreate={() => void handleCreate()}
          searchControlsOpen={searchControlsOpen}
          onSearchControlsOpenChange={onSearchControlsOpenChange}
          albumListSearchFiltersActiveCount={albumListSearchFiltersActiveCount}
          store={store}
          viewMode={viewMode}
          albumQuickFiltersOpen={albumQuickFiltersOpen}
          onAlbumQuickFiltersOpenChange={setAlbumQuickFiltersOpen}
          albumQuickFiltersActiveCount={albumQuickFiltersActiveCount}
          albumQuickFilters={albumQuickFilters}
          onAlbumQuickFiltersChange={setAlbumQuickFilters}
          quickFiltersMenuWrapRef={quickFiltersMenuWrapRef}
        />
        {!showingSmart && !showingDetail && !showingCreate ? (
          <>
            {searchControlsOpen ? (
              <section className="relative shrink-0 border-b border-ai-search-border bg-ai-search-panel px-4 py-2.5 pr-[4.75rem] text-ai-search-text">
                <button
                  type="button"
                  className="absolute right-4 top-2.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-ai-search-border bg-ai-search-control text-ai-search-text hover:bg-ai-search-control/80"
                  onClick={() => onSearchControlsOpenChange(false)}
                  aria-label="Close album search filters"
                  title="Close album search filters"
                >
                  <X size={16} aria-hidden="true" />
                </button>
                <div className="mt-2 flex flex-wrap items-start gap-x-4 gap-y-3 [&_input]:border-ai-search-border [&_input:not(:placeholder-shown):not(:focus)]:border-ai-search-accent [&_input]:bg-ai-search-control [&_input]:text-ai-search-text [&_input]:placeholder:text-ai-search-muted/75 [&_input]:focus:border-ai-search-accent [&_input]:focus:ring-ai-search-accent/45">
                  <label className={`grid min-w-0 gap-1 ${ALBUM_LIST_TITLE_INPUT_MAX_CLASS}`}>
                    <span className="text-xs font-medium text-ai-search-muted">Title</span>
                    <Input
                      value={titleDraft}
                      onChange={(event) => setTitleDraft(event.target.value)}
                      placeholder="Album title"
                    />
                  </label>
                  <label className={`grid min-w-0 gap-1 ${ALBUM_LIST_LOCATION_INPUT_MAX_CLASS}`}>
                    <span className="text-xs font-medium text-ai-search-muted">Location</span>
                    <Input
                      value={locationDraft}
                      onChange={(event) => setLocationDraft(event.target.value)}
                      placeholder="Country, area, or city"
                    />
                  </label>
                  <div ref={albumDateRangeFieldShellRefCallback} className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-start gap-3">
                      <label className="grid w-fit max-w-full gap-1">
                        <span className="text-xs font-medium text-ai-search-muted">From</span>
                        <Input
                          value={yearMonthFromDraft}
                          onChange={(event) =>
                            setYearMonthFromDraft(sanitizeAlbumYearMonthDigitsInput(event.target.value))
                          }
                          placeholder={ALBUM_YEAR_MONTH_INPUT_PLACEHOLDER}
                          inputMode="numeric"
                          autoComplete="off"
                          spellCheck={false}
                          className="w-[13ch] max-w-full min-w-0 font-mono text-sm tabular-nums"
                        />
                      </label>
                      <label className="grid w-fit max-w-full gap-1">
                        <span className="text-xs font-medium text-ai-search-muted">To</span>
                        <Input
                          value={yearMonthToDraft}
                          onChange={(event) =>
                            setYearMonthToDraft(sanitizeAlbumYearMonthDigitsInput(event.target.value))
                          }
                          placeholder={ALBUM_YEAR_MONTH_INPUT_PLACEHOLDER}
                          inputMode="numeric"
                          autoComplete="off"
                          spellCheck={false}
                          className="w-[13ch] max-w-full min-w-0 font-mono text-sm tabular-nums"
                        />
                      </label>
                    </div>
                    <p
                      className={`min-h-[1.25rem] text-xs text-ai-search-muted ${
                        showAlbumDateRangeHint ? "" : "invisible"
                      }`}
                      aria-hidden={!showAlbumDateRangeHint}
                    >
                      {ALBUM_YEAR_MONTH_INPUT_HINT}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <SemanticSearchPersonTagsBar
                    tagsMeta={personTags}
                    selectedTagIds={personTagIds}
                    onToggleTag={togglePersonTag}
                  />
                  <label
                    className="mt-2 flex cursor-pointer items-center gap-1.5 text-xs text-ai-search-text/80 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
                    title={personTagIds.length === 0 ? "Select at least one person tag" : undefined}
                  >
                    <input
                      type="checkbox"
                      className="cursor-pointer accent-ai-search-accent"
                      checked={includeUnconfirmedAlbumFaces}
                      disabled={personTagIds.length === 0}
                      onChange={(event) => setIncludeUnconfirmedAlbumFaces(event.target.checked)}
                    />
                    <span>Include unconfirmed similar faces</span>
                  </label>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
        {showingSmart && (smartAlbumRootKind === "best-of-year" || smartAlbumRootKind === "country-area-city") && showSmartFilterPanel ? (
          <BestOfYearFiltersPanel
            filters={smartAlbumFilters}
            personTags={personTags}
            onClose={() => setSmartFilterPanelOpen(false)}
            onClear={() => setSmartAlbumFilters(EMPTY_SMART_ALBUM_FILTERS)}
            onFiltersChange={setSmartAlbumFilters}
            onTogglePersonTag={toggleSmartFilterPersonTag}
          />
        ) : null}
      </div>
      {errorMessage ? (
        <div className="mx-4 mt-3 rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}
      {showingSmart ? (
        <SmartAlbumsWorkspace
          isLoading={isLoading}
          activeSmartAlbum={activeSmartAlbum}
          smartPlaceRequest={smartPlaceRequest}
          smartPlaceCountries={smartPlaceCountries}
          smartYears={smartYears}
          expandedSmartCountries={expandedSmartCountries}
          expandedSmartGroups={expandedSmartGroups}
          smartPlaceGroupLabel={smartPlaceGroupLabel}
          smartPlaceEntryLabel={smartPlaceEntryLabel}
          smartItems={smartItems}
          smartItemsPage={smartItemsPage}
          smartItemsTotal={smartItemsTotal}
          smartPlaceHierarchyLevels={smartPlaceHierarchyLevels}
          quickFilters={albumQuickFilters}
          viewMode={viewMode}
          store={store}
          onToggleCountry={toggleSmartCountry}
          onToggleGroup={toggleSmartGroup}
          onSmartPlaceHierarchyLevelsChange={setSmartPlaceHierarchyLevels}
          onActiveSmartAlbumChange={setActiveSmartAlbum}
          onSmartItemsPageChange={setSmartItemsPage}
        />
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
          {isLoading ? (
            <div
              className="flex items-center gap-2.5 text-lg font-medium text-primary"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="size-6 shrink-0 animate-spin" strokeWidth={2.25} aria-hidden />
              <span>Loading...</span>
            </div>
          ) : null}
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

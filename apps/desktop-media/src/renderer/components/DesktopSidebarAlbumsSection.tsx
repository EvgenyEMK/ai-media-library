import { useEffect, useMemo, useState, type ReactElement } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { SmartAlbumRootKind } from "@emk/shared-contracts";
import { createDesktopAlbumActions } from "../actions/album-actions";
import { DEFAULT_SIDEBAR_ALBUMS_EXPAND_RECENT } from "../lib/sidebar-albums-ui-defaults";
import { useDesktopStore, useDesktopStoreApi } from "../stores/desktop-store";
import { Input } from "./ui/input";

const UI_TEXT = {
  compactLabel: "Albums",
  recent: "RECENT",
  smartAlbums: "SMART ALBUMS",
  allAlbums: "ALL ALBUMS",
  bestOfYearMonthDay: "Best of Year | Month | Day",
  countries: "Countries",
  countryYearArea: "Country > Year > Area",
  countryAreaCity: "Country > Area > City",
  bestOfYear: "Best of Year",
} as const;

/** Matches active section style in `MainAppSidebar` (`border-primary` + `bg-primary/10`). */
function sidebarSelectableRowClassName(selected: boolean, paddingClass: string): string {
  return `block w-full truncate rounded-md text-left text-sm shadow-none outline-none hover:bg-muted ${paddingClass} ${
    selected
      ? "border border-primary bg-primary/10 text-foreground hover:bg-primary/10"
      : "border border-transparent bg-transparent text-foreground"
  }`;
}

function smartAlbumRowClassName(selected: boolean): string {
  return sidebarSelectableRowClassName(selected, "py-1.5 pl-7 pr-5");
}

type ExpandedAlbumSubsection = "recent" | "smart" | "all" | null;

function AlbumSectionHeader({
  title,
  expanded,
  onToggle,
  nested = false,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  nested?: boolean;
}): ReactElement {
  const Icon = expanded ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex h-8 w-full items-center gap-1 rounded bg-transparent text-left font-semibold uppercase tracking-wide text-muted-foreground ${
        nested ? "px-3 text-xs" : "px-1.5 text-sm"
      }`}
      aria-expanded={expanded}
    >
      <Icon size={16} aria-hidden="true" />
      <span>{title}</span>
    </button>
  );
}

export function DesktopSidebarAlbumsSection({
  collapsed,
  expandRecentAlbumsByDefault,
  onAlbumSelected,
  onSmartAlbumSelected,
  onShowAlbumList,
  highlightedSmartAlbumKind = null,
}: {
  collapsed: boolean;
  /** When omitted, uses `DEFAULT_SIDEBAR_ALBUMS_EXPAND_RECENT` (for future app settings). */
  expandRecentAlbumsByDefault?: boolean;
  onAlbumSelected?: () => void;
  onSmartAlbumSelected?: (kind: SmartAlbumRootKind) => void;
  onShowAlbumList?: () => void;
  /** Active smart album root when the albums workspace is in smart mode (row highlight). */
  highlightedSmartAlbumKind?: SmartAlbumRootKind | null;
}): ReactElement {
  const store = useDesktopStoreApi();
  const albums = useDesktopStore((s) => s.albums);
  const selectedAlbumId = useDesktopStore((s) => s.selectedAlbumId);
  const recentAlbumIds = useDesktopStore((s) => s.recentAlbumIds);
  const [expandedSection, setExpandedSection] = useState<ExpandedAlbumSubsection>(() =>
    (expandRecentAlbumsByDefault ?? DEFAULT_SIDEBAR_ALBUMS_EXPAND_RECENT) ? "recent" : null,
  );
  const [visibleRecentAlbumIds, setVisibleRecentAlbumIds] = useState<string[]>(recentAlbumIds);
  const [titleQuery, setTitleQuery] = useState("");
  const [expandedSmartSubBestOfTime, setExpandedSmartSubBestOfTime] = useState(true);
  const [expandedSmartSubCountries, setExpandedSmartSubCountries] = useState(true);
  const actions = useMemo(() => createDesktopAlbumActions(store), [store]);

  useEffect(() => {
    void actions.loadAlbums({ limit: 200 });
  }, [actions]);

  useEffect(() => {
    if (recentAlbumIds.length === 0) {
      setExpandedSection((current) => (current === "recent" ? null : current));
    }
  }, [recentAlbumIds.length]);

  useEffect(() => {
    if (expandedSection === "recent" && visibleRecentAlbumIds.length === 0 && recentAlbumIds.length > 0) {
      setVisibleRecentAlbumIds(recentAlbumIds);
    }
  }, [expandedSection, recentAlbumIds, visibleRecentAlbumIds.length]);

  const albumsById = useMemo(() => new Map(albums.map((album) => [album.id, album] as const)), [albums]);
  const recentAlbums = visibleRecentAlbumIds
    .map((id) => albumsById.get(id))
    .filter((album): album is NonNullable<typeof album> => album !== undefined)
    .slice(0, 10);
  const normalizedQuery = titleQuery.trim().toLocaleLowerCase();
  const matchingAlbums = albums
    .filter((album) => (normalizedQuery ? album.title.toLocaleLowerCase().includes(normalizedQuery) : true))
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title));

  const toggleSection = (section: Exclude<ExpandedAlbumSubsection, null>): void => {
    setExpandedSection((current) => {
      if (current === section) {
        return null;
      }
      if (section === "recent") {
        setVisibleRecentAlbumIds(recentAlbumIds);
      }
      if (section === "all") {
        onShowAlbumList?.();
      }
      return section;
    });
  };

  const selectAlbum = (albumId: string): void => {
    store.getState().selectAlbum(albumId);
    onAlbumSelected?.();
  };

  const selectSmartAlbum = (kind: SmartAlbumRootKind): void => {
    store.getState().selectAlbum(null);
    onSmartAlbumSelected?.(kind);
  };

  if (collapsed) {
    return <div className="text-xs text-muted-foreground">{UI_TEXT.compactLabel}</div>;
  }

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <div className="space-y-1">
        <Input
          value={titleQuery}
          onChange={(event) => setTitleQuery(event.target.value)}
          placeholder="Search albums"
          className="h-8 text-sm"
        />
        {normalizedQuery
          ? matchingAlbums.map((album) => (
              <button
                key={album.id}
                type="button"
                data-testid={`desktop-sidebar-album-search-${album.id}`}
                onClick={() => selectAlbum(album.id)}
                className={sidebarSelectableRowClassName(
                  album.id === selectedAlbumId,
                  "px-5 py-1.5",
                )}
                title={album.title}
              >
                {album.title}
              </button>
            ))
          : null}
      </div>
      <AlbumSectionHeader
        title={UI_TEXT.recent}
        expanded={expandedSection === "recent"}
        onToggle={() => toggleSection("recent")}
      />
      {expandedSection === "recent"
        ? recentAlbums.map((album) => (
            <button
              key={album.id}
              type="button"
              onClick={() => selectAlbum(album.id)}
              className={sidebarSelectableRowClassName(album.id === selectedAlbumId, "px-5 py-1.5")}
              title={album.title}
            >
              {album.title}
            </button>
          ))
        : null}
      <AlbumSectionHeader
        title={UI_TEXT.allAlbums}
        expanded={expandedSection === "all"}
        onToggle={() => toggleSection("all")}
      />
      {expandedSection === "all" ? <div className="space-y-1" /> : null}
      <AlbumSectionHeader
        title={UI_TEXT.smartAlbums}
        expanded={expandedSection === "smart"}
        onToggle={() => toggleSection("smart")}
      />
      {expandedSection === "smart" ? (
        <div className="space-y-1">
          <AlbumSectionHeader
            nested
            title={UI_TEXT.bestOfYearMonthDay}
            expanded={expandedSmartSubBestOfTime}
            onToggle={() => setExpandedSmartSubBestOfTime((open) => !open)}
          />
          {expandedSmartSubBestOfTime ? (
            <button
              type="button"
              onClick={() => selectSmartAlbum("best-of-year")}
              className={smartAlbumRowClassName(highlightedSmartAlbumKind === "best-of-year")}
            >
              {UI_TEXT.bestOfYear}
            </button>
          ) : null}
          <AlbumSectionHeader
            nested
            title={UI_TEXT.countries}
            expanded={expandedSmartSubCountries}
            onToggle={() => setExpandedSmartSubCountries((open) => !open)}
          />
          {expandedSmartSubCountries ? (
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => selectSmartAlbum("country-year-area")}
                className={smartAlbumRowClassName(highlightedSmartAlbumKind === "country-year-area")}
              >
                {UI_TEXT.countryYearArea}
              </button>
              <button
                type="button"
                onClick={() => selectSmartAlbum("country-area-city")}
                className={smartAlbumRowClassName(highlightedSmartAlbumKind === "country-area-city")}
              >
                {UI_TEXT.countryAreaCity}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

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
  countryYearCity: "Country > Year > Area",
  countryAreaCity: "Country > Area > City",
  countryMonthArea: "Country > YYYY-MM Area",
  aiCountries: "AI countries",
  bestOfYear: "Best of Year",
} as const;

type ExpandedAlbumSubsection = "recent" | "smart" | "all" | null;

function AlbumSectionHeader({
  title,
  expanded,
  onToggle,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
}): ReactElement {
  const Icon = expanded ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-8 w-full items-center gap-1 rounded bg-transparent px-1.5 text-left text-sm font-semibold uppercase tracking-wide text-muted-foreground"
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
}: {
  collapsed: boolean;
  /** When omitted, uses `DEFAULT_SIDEBAR_ALBUMS_EXPAND_RECENT` (for future app settings). */
  expandRecentAlbumsByDefault?: boolean;
  onAlbumSelected?: () => void;
  onSmartAlbumSelected?: (kind: SmartAlbumRootKind) => void;
  onShowAlbumList?: () => void;
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
                className={`block w-full truncate rounded border-0 px-5 py-1.5 text-left text-sm shadow-none outline-none hover:bg-muted ${
                  album.id === selectedAlbumId ? "bg-primary/10 text-foreground hover:bg-primary/10" : "bg-transparent text-foreground"
                }`}
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
              className={`block w-full truncate rounded border-0 px-5 py-1.5 text-left text-sm shadow-none outline-none hover:bg-muted ${
                album.id === selectedAlbumId ? "bg-primary/10 text-foreground hover:bg-primary/10" : "bg-transparent text-foreground"
              }`}
              title={album.title}
            >
              {album.title}
            </button>
          ))
        : null}
      <AlbumSectionHeader
        title={UI_TEXT.smartAlbums}
        expanded={expandedSection === "smart"}
        onToggle={() => toggleSection("smart")}
      />
      {expandedSection === "smart" ? (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => selectSmartAlbum("country-year-city")}
            className="block w-full truncate rounded border-0 bg-transparent px-5 py-1.5 text-left text-sm text-foreground shadow-none outline-none hover:bg-muted"
          >
            {UI_TEXT.countryYearCity}
          </button>
          <button
            type="button"
            onClick={() => selectSmartAlbum("country-area-city")}
            className="block w-full truncate rounded border-0 bg-transparent px-5 py-1.5 text-left text-sm text-foreground shadow-none outline-none hover:bg-muted"
          >
            {UI_TEXT.countryAreaCity}
          </button>
          <button
            type="button"
            onClick={() => selectSmartAlbum("country-month-area")}
            className="block w-full truncate rounded border-0 bg-transparent px-5 py-1.5 text-left text-sm text-foreground shadow-none outline-none hover:bg-muted"
          >
            {UI_TEXT.countryMonthArea}
          </button>
          <button
            type="button"
            onClick={() => selectSmartAlbum("ai-countries")}
            className="block w-full truncate rounded border-0 bg-transparent px-5 py-1.5 text-left text-sm text-foreground shadow-none outline-none hover:bg-muted"
          >
            {UI_TEXT.aiCountries}
          </button>
          <button
            type="button"
            onClick={() => selectSmartAlbum("best-of-year")}
            className="block w-full truncate rounded border-0 bg-transparent px-5 py-1.5 text-left text-sm text-foreground shadow-none outline-none hover:bg-muted"
          >
            {UI_TEXT.bestOfYear}
          </button>
        </div>
      ) : null}
      <AlbumSectionHeader
        title={UI_TEXT.allAlbums}
        expanded={expandedSection === "all"}
        onToggle={() => toggleSection("all")}
      />
      {expandedSection === "all" ? <div className="space-y-1" /> : null}
    </div>
  );
}

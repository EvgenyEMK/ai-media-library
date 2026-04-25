import { useEffect, useMemo, useState, type ReactElement } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { createDesktopAlbumActions } from "../actions/album-actions";
import { useDesktopStore, useDesktopStoreApi } from "../stores/desktop-store";
import { Input } from "./ui/input";

const UI_TEXT = {
  compactLabel: "Albums",
  recent: "RECENT",
  allAlbums: "All albums",
} as const;

type ExpandedAlbumSubsection = "recent" | "all" | null;

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
  onAlbumSelected,
  onShowAlbumList,
}: {
  collapsed: boolean;
  onAlbumSelected?: () => void;
  onShowAlbumList?: () => void;
}): ReactElement {
  const store = useDesktopStoreApi();
  const albums = useDesktopStore((s) => s.albums);
  const selectedAlbumId = useDesktopStore((s) => s.selectedAlbumId);
  const recentAlbumIds = useDesktopStore((s) => s.recentAlbumIds);
  const [expandedSection, setExpandedSection] = useState<ExpandedAlbumSubsection>("recent");
  const [visibleRecentAlbumIds, setVisibleRecentAlbumIds] = useState<string[]>(recentAlbumIds);
  const [titleQuery, setTitleQuery] = useState("");
  const actions = useMemo(() => createDesktopAlbumActions(store), [store]);

  useEffect(() => {
    void actions.loadAlbums({ limit: 200 });
  }, [actions]);

  useEffect(() => {
    if (recentAlbumIds.length === 0) {
      setExpandedSection("all");
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

  if (collapsed) {
    return <div className="text-xs text-muted-foreground">{UI_TEXT.compactLabel}</div>;
  }

  return (
    <div className="space-y-1 text-xs text-muted-foreground">
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
        title={UI_TEXT.allAlbums}
        expanded={expandedSection === "all"}
        onToggle={() => toggleSection("all")}
      />
      {expandedSection === "all" ? (
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
      ) : null}
    </div>
  );
}

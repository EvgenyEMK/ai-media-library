import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import { MediaItemActionsMenu, MediaItemActionsMenuArrowRightIcon } from "@emk/media-viewer";
import type { AlbumMembership, MediaAlbumSummary } from "@emk/shared-contracts";
import { UI_TEXT } from "../lib/ui-text";
import { createDesktopAlbumActions } from "../actions/album-actions";
import { useDesktopStore, useDesktopStoreApi } from "../stores/desktop-store";
import { Input } from "./ui/input";

function ChevronLeftIcon(): ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M10 3.5L5.5 8L10 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon(): ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M5.5 5.5L14.5 14.5M14.5 5.5L5.5 14.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type AlbumChoice = Pick<MediaAlbumSummary, "id" | "title">;

interface DesktopMediaItemActionsMenuProps {
  filePath: string;
  mediaType?: "image" | "video";
  onOpenChange?: (open: boolean) => void;
}

function AlbumsMenuPanel({
  filePath,
}: {
  filePath: string;
}): ReactElement {
  const store = useDesktopStoreApi();
  const albums = useDesktopStore((s) => s.albums);
  const recentAlbumIds = useDesktopStore((s) => s.recentAlbumIds);
  const [query, setQuery] = useState("");
  const [memberships, setMemberships] = useState<AlbumMembership[]>([]);
  const [orderingMembershipIds, setOrderingMembershipIds] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const actions = useMemo(() => createDesktopAlbumActions(store), [store]);

  const membershipIds = useMemo(
    () => new Set(memberships.map((membership) => membership.albumId)),
    [memberships],
  );

  const refreshMemberships = useCallback(async (): Promise<void> => {
    const next = await actions.listAlbumsForMediaItem(filePath);
    setMemberships(next);
  }, [actions, filePath]);

  const loadPanel = useCallback(async (): Promise<void> => {
    setLoading(true);
    setStatus(null);
    try {
      const [albumResult, membershipResult] = await Promise.all([
        actions.loadAlbums({ limit: 200 }),
        actions.listAlbumsForMediaItem(filePath),
      ]);
      store.getState().setAlbums(albumResult.rows);
      setMemberships(membershipResult);
      setOrderingMembershipIds(membershipResult.map((membership) => membership.albumId));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load albums.");
    } finally {
      setLoading(false);
    }
  }, [actions, filePath, store]);

  useEffect(() => {
    void loadPanel();
  }, [loadPanel]);

  const toggleAlbum = async (album: Pick<MediaAlbumSummary, "id" | "title">): Promise<void> => {
    setStatus(null);
    if (membershipIds.has(album.id)) {
      await actions.removeMediaItemFromAlbum(album.id, filePath);
      await refreshMemberships();
      return;
    }
    await actions.addMediaItemsToAlbum(album.id, [filePath]);
    await refreshMemberships();
  };

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const albumsById = useMemo(() => new Map(albums.map((album) => [album.id, album] as const)), [albums]);
  const visibleAlbums = useMemo(() => {
    const matchesQuery = (album: AlbumChoice): boolean =>
      normalizedQuery ? album.title.toLocaleLowerCase().includes(normalizedQuery) : true;
    const membershipTitleById = new Map(memberships.map((membership) => [membership.albumId, membership.title] as const));
    const memberAlbums: AlbumChoice[] = orderingMembershipIds
      .map((albumId) => albumsById.get(albumId) ?? { id: albumId, title: membershipTitleById.get(albumId) ?? "Album" })
      .filter((album) => matchesQuery(album));
    const memberIds = new Set(memberAlbums.map((album) => album.id));
    const recent = recentAlbumIds
      .map((id) => albumsById.get(id))
      .filter((album): album is MediaAlbumSummary =>
        album !== undefined && !memberIds.has(album.id) && matchesQuery(album),
      );
    const prioritizedIds = new Set([...memberIds, ...recent.map((album) => album.id)]);
    const remaining = albums.filter((album) => !prioritizedIds.has(album.id) && matchesQuery(album));
    return [...memberAlbums, ...recent, ...remaining].slice(0, 5);
  }, [albums, albumsById, memberships, normalizedQuery, orderingMembershipIds, recentAlbumIds]);

  return (
    <div className="mt-1 w-72 border-t border-slate-700 pt-2 text-slate-100">
      <div className="px-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (albums.length === 0) void loadPanel();
          }}
          placeholder="Find album"
          className="h-9 border-slate-600 bg-slate-950 text-sm text-slate-100 placeholder:text-slate-500"
        />
      </div>
      {status ? <div className="px-2 py-1 text-sm text-slate-400">{status}</div> : null}
      <div className="mt-2">
        {loading ? (
          <div className="px-2 py-2 text-sm text-slate-400">Loading...</div>
        ) : visibleAlbums.length === 0 ? (
          <div className="px-2 py-2 text-sm text-slate-400">No albums found.</div>
        ) : (
          visibleAlbums.map((album) => (
            <button
              key={album.id}
              type="button"
              className="flex w-full items-center gap-2 rounded-md border-0 bg-transparent px-3 py-2.5 text-left text-sm text-slate-200 shadow-none outline-none hover:bg-slate-800"
              onClick={() => void toggleAlbum(album)}
            >
              <input type="checkbox" checked={membershipIds.has(album.id)} readOnly className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{album.title}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export function DesktopMediaItemActionsMenu({
  filePath,
  mediaType = "image",
  onOpenChange,
}: DesktopMediaItemActionsMenuProps): ReactElement {
  const [albumsPanelOpen, setAlbumsPanelOpen] = useState(false);
  const handleOpenChange = (open: boolean): void => {
    if (!open) {
      setAlbumsPanelOpen(false);
    }
    onOpenChange?.(open);
  };
  const videoOnlyNoticeAction = mediaType === "video"
    ? [
        {
          id: "video-ai-unavailable",
          label: UI_TEXT.videoAiUnavailable,
          disabled: true,
        },
      ]
    : [];

  return (
    <MediaItemActionsMenu
      onOpenChange={handleOpenChange}
      actions={albumsPanelOpen
        ? []
        : [
            {
              id: "albums",
              label: "Albums",
              trailingIcon: <MediaItemActionsMenuArrowRightIcon />,
              closeOnSelect: false,
              onSelect: () => setAlbumsPanelOpen(true),
            },
            {
              id: "reveal",
              label: UI_TEXT.revealInFileExplorer,
              onSelect: () => {
                void window.desktopApi.revealItemInFolder(filePath).then((result) => {
                  if (!result.success && result.error) {
                    window.desktopApi._logToMain(`[reveal-item] ${result.error}`);
                  }
                });
              },
            },
            {
              id: "copy-path",
              label: UI_TEXT.copyFilePath,
              onSelect: () => {
                void navigator.clipboard.writeText(filePath);
              },
            },
            ...videoOnlyNoticeAction,
          ]}
      renderContent={({ closeMenu }) => {
        if (!albumsPanelOpen) {
          return null;
        }
        return (
          <>
            <div
              role="menuitem"
              tabIndex={0}
              className="flex w-full items-center gap-2 rounded-md border-0 bg-transparent px-3 py-2.5 text-left text-[15px] text-slate-200 hover:bg-slate-800"
              onClick={() => setAlbumsPanelOpen(false)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setAlbumsPanelOpen(false);
                }
              }}
            >
              <ChevronLeftIcon />
              <span className="min-w-0 flex-1 truncate">Albums</span>
              <button
                type="button"
                aria-label="Close menu"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded text-slate-300 hover:bg-slate-700 hover:text-slate-100"
                onClick={(event) => {
                  event.stopPropagation();
                  closeMenu();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    closeMenu();
                  }
                }}
              >
                <CloseIcon />
              </button>
            </div>
            <AlbumsMenuPanel filePath={filePath} />
          </>
        );
      }}
    />
  );
}

import type { ReactElement } from "react";
import { MediaThumbnailGrid } from "@emk/media-viewer";
import type { AlbumMediaItem, MediaAlbumSummary } from "@emk/shared-contracts";
import type { ViewerItemListEntry } from "@emk/media-store";
import type { DesktopAlbumActions } from "../actions/album-actions";
import type { DesktopStore } from "../stores/desktop-store";
import { toFileUrl } from "./face-cluster-utils";
import { PeoplePaginationBar } from "./people-pagination-bar";
import { Input } from "./ui/input";

export const ALBUM_ITEMS_PAGE_SIZE = 48;

export function albumItemToViewerEntry(item: AlbumMediaItem): ViewerItemListEntry {
  const url = toFileUrl(item.sourcePath);
  return {
    id: item.sourcePath,
    sourcePath: item.sourcePath,
    title: item.title,
    storage_url: url,
    thumbnail_url: url,
    width: item.width,
    height: item.height,
    mediaItemId: item.id,
    mediaType: item.mediaKind,
  };
}

export function DesktopAlbumDetailPanel({
  store,
  actions,
  selectedAlbum,
  albumItems,
  albumItemsPage,
  albumItemsTotal,
  renameTitle,
  folderMediaIds,
  onRenameTitleChange,
  onAlbumItemsPageChange,
  onRefreshSelectedAlbum,
}: {
  store: DesktopStore;
  actions: DesktopAlbumActions;
  selectedAlbum: MediaAlbumSummary | null;
  albumItems: AlbumMediaItem[];
  albumItemsPage: number;
  albumItemsTotal: number;
  renameTitle: string;
  folderMediaIds: string[];
  onRenameTitleChange: (value: string) => void;
  onAlbumItemsPageChange: (page: number) => void;
  onRefreshSelectedAlbum: () => Promise<void>;
}): ReactElement {
  const viewerEntries = albumItems.map(albumItemToViewerEntry);

  if (!selectedAlbum) {
    return (
      <div className="text-sm text-muted-foreground">
        Select an album to view and manage its media.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Input value={renameTitle} onChange={(event) => onRenameTitleChange(event.target.value)} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
            onClick={() =>
              void actions.renameAlbum(selectedAlbum.id, renameTitle).then(onRefreshSelectedAlbum)
            }
          >
            Rename
          </button>
          <button
            type="button"
            className="rounded-md border border-destructive/60 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            onClick={() => void actions.deleteAlbum(selectedAlbum.id)}
          >
            Delete
          </button>
          <button
            type="button"
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
            disabled={folderMediaIds.length === 0}
            onClick={() =>
              void actions.addMediaItemsToAlbum(selectedAlbum.id, folderMediaIds).then(onRefreshSelectedAlbum)
            }
          >
            Add current folder media
          </button>
        </div>
      </div>
      {albumItems.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          This album is empty. Open a folder first, then use “Add current folder media”.
        </div>
      ) : (
        <>
          <MediaThumbnailGrid
            items={albumItems.map((item) => ({
              id: item.id,
              title: item.title,
              imageUrl: toFileUrl(item.sourcePath),
              starRating: item.starRating,
              mediaType: item.mediaKind,
            }))}
            onItemClick={(index) => {
              store.getState().openViewer(index, "album", {
                itemListOverride: viewerEntries,
                autoPlayInitialVideo: albumItems[index]?.mediaKind === "video",
              });
            }}
            renderActions={(item) => (
              <div className="flex flex-col gap-1 rounded-md bg-background/95 p-1 text-xs shadow">
                <button
                  type="button"
                  className="px-2 py-1 text-left hover:bg-muted"
                  onClick={() =>
                    void actions.setAlbumCover(selectedAlbum.id, item.id).then(onRefreshSelectedAlbum)
                  }
                >
                  Set as cover
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-left text-destructive hover:bg-muted"
                  onClick={() =>
                    void actions
                      .removeMediaItemFromAlbum(selectedAlbum.id, item.id)
                      .then(onRefreshSelectedAlbum)
                  }
                >
                  Remove
                </button>
              </div>
            )}
            priorityCount={8}
            scrollable={false}
          />
          <PeoplePaginationBar
            ariaLabel="Album items pagination"
            currentPage={albumItemsPage}
            totalItems={albumItemsTotal}
            pageSize={ALBUM_ITEMS_PAGE_SIZE}
            onPageChange={onAlbumItemsPageChange}
          />
        </>
      )}
    </div>
  );
}

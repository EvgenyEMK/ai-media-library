import type { ReactElement } from "react";
import type { MediaAlbumSummary } from "@emk/shared-contracts";
import { toFileUrl } from "./face-cluster-utils";

function coverUrl(album: MediaAlbumSummary): string | null {
  return album.coverImageUrl ?? (album.coverSourcePath ? toFileUrl(album.coverSourcePath) : null);
}

function PhotoPlaceholderIcon(): ReactElement {
  return (
    <svg width="144" height="144" viewBox="0 0 72 72" aria-hidden="true" focusable="false">
      <rect
        x="10"
        y="14"
        width="52"
        height="44"
        rx="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
      <circle cx="27" cy="29" r="5" fill="currentColor" opacity="0.75" />
      <path
        d="M15 52L30 39L40 47L49 36L59 52"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DesktopAlbumCard({
  album,
  selected,
  onClick,
}: {
  album: MediaAlbumSummary;
  selected: boolean;
  onClick: () => void;
}): ReactElement {
  const people = album.personTags.slice(0, 3).map((tag) => tag.label).join(", ");
  const cover = coverUrl(album);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`overflow-hidden rounded-lg border bg-card text-left shadow-sm transition hover:border-primary/70 ${
        selected ? "border-primary ring-1 ring-primary/50" : "border-border"
      }`}
    >
      <div className="aspect-[4/3] bg-muted">
        {cover ? (
          album.coverMediaKind === "video" ? (
            <video className="h-full w-full object-cover" src={cover} muted />
          ) : (
            <img
              className="h-full w-full object-cover"
              src={cover}
              alt=""
              loading="lazy"
              decoding="async"
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/70">
            <PhotoPlaceholderIcon />
          </div>
        )}
      </div>
      <div className="space-y-1 p-3">
        <div className="truncate font-medium text-foreground">{album.title}</div>
        <div className="text-xs text-muted-foreground">
          {album.mediaCount} item{album.mediaCount === 1 ? "" : "s"}
          {album.locationSummary ? ` · ${album.locationSummary}` : ""}
        </div>
        {people ? <div className="truncate text-xs text-muted-foreground">{people}</div> : null}
      </div>
    </button>
  );
}

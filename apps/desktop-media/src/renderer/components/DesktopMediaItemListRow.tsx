import { useState, type ReactElement, type ReactNode } from "react";
import { MediaItemListRow } from "@emk/media-viewer";
import { DesktopMediaItemActionsMenu } from "./DesktopMediaItemActionsMenu";

interface DesktopMediaItemListRowProps {
  title: string;
  onRowClick: () => void;
  metadataLine?: string;
  folderLine?: string;
  filePath: string;
  mediaType?: "image" | "video";
  thumbnail: ReactNode;
  starRating?: number | null;
  onStarRatingChange?: (next: number) => void;
  starRatingShowRejected?: boolean;
}

export function DesktopMediaItemListRow({
  title,
  onRowClick,
  metadataLine,
  folderLine,
  filePath,
  mediaType = "image",
  thumbnail,
  starRating,
  onStarRatingChange,
  starRatingShowRejected = false,
}: DesktopMediaItemListRowProps): ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <MediaItemListRow
      title={title}
      onClick={onRowClick}
      metadataLine={metadataLine}
      folderLine={folderLine}
      starRating={starRating}
      onStarRatingChange={onStarRatingChange}
      starRatingShowRejected={starRatingShowRejected}
      forceShowActions={menuOpen}
      thumbnail={thumbnail}
      actions={(
        <DesktopMediaItemActionsMenu
          filePath={filePath}
          mediaType={mediaType}
          onOpenChange={setMenuOpen}
        />
      )}
    />
  );
}

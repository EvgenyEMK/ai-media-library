import type { ReactElement } from "react";
import { MediaItemActionsMenu } from "@emk/media-viewer";
import { UI_TEXT } from "../lib/ui-text";

interface DesktopMediaItemActionsMenuProps {
  filePath: string;
  mediaType?: "image" | "video";
  onOpenChange?: (open: boolean) => void;
}

export function DesktopMediaItemActionsMenu({
  filePath,
  mediaType = "image",
  onOpenChange,
}: DesktopMediaItemActionsMenuProps): ReactElement {
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
      onOpenChange={onOpenChange}
      actions={[
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
    />
  );
}

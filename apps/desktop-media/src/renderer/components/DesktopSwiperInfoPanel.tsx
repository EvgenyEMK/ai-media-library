import type { ReactElement } from "react";
import { getPeopleBoundingBoxes } from "@emk/media-metadata-core";
import type { DesktopMediaItemMetadata } from "../../shared/ipc";
import { DesktopViewerInfoPanel } from "./DesktopViewerInfoPanel";
import type { DesktopViewerItem } from "../types/viewer-types";

interface DesktopSwiperInfoPanelProps {
  item: DesktopViewerItem;
  metadata: DesktopMediaItemMetadata | undefined;
  onRefreshMetadata: (sourcePath: string) => Promise<DesktopMediaItemMetadata | undefined>;
}

export function DesktopSwiperInfoPanel({
  item,
  metadata,
  onRefreshMetadata,
}: DesktopSwiperInfoPanelProps): ReactElement {
  const peopleBoundingBoxes = metadata?.aiMetadata ? getPeopleBoundingBoxes(metadata.aiMetadata) : [];
  return (
    <DesktopViewerInfoPanel
      item={item}
      metadata={metadata}
      peopleBoundingBoxes={peopleBoundingBoxes}
      onRefreshMetadata={onRefreshMetadata}
    />
  );
}

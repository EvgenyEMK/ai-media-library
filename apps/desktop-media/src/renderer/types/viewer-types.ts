import type { BeingBoundingBox } from "@emk/media-metadata-core";
import type { DesktopMediaItemMetadata } from "../../shared/ipc";

export interface DesktopViewerItem {
  id: string;
  mediaItemId?: string | null;
  title: string;
  storage_url: string;
  thumbnail_url: string;
  width?: number | null;
  height?: number | null;
  sourcePath: string;
}

export interface DesktopViewerInfoPanelProps {
  item: DesktopViewerItem;
  metadata: DesktopMediaItemMetadata | undefined;
  peopleBoundingBoxes: BeingBoundingBox[];
  onRefreshMetadata: (sourcePath: string) => Promise<DesktopMediaItemMetadata | undefined>;
}

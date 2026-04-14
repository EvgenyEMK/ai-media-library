import { useSyncExternalStore } from "react";
import type {
  FrameSize,
  ImageNaturalSize,
  MainImageFitResult,
  ThumbSize,
} from "./viewer-styles";
import type { MediaSwiperViewerItem } from "./types";

const XL_QUERY = "(min-width: 1280px)";
const subscribeXl = (cb: () => void) => {
  const mql = window.matchMedia(XL_QUERY);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
};
const getXlSnapshot = () => window.matchMedia(XL_QUERY).matches;
const getXlServerSnapshot = () => false;

export function useResolvedThumbSize(thumbSize: ThumbSize): "normal" | "large" {
  const isXl = useSyncExternalStore(subscribeXl, getXlSnapshot, getXlServerSnapshot);
  if (thumbSize === "auto") return isXl ? "large" : "normal";
  return thumbSize;
}

export function resolveMainImageFit(
  autoFitImageToFrame: boolean,
  frameSize: FrameSize | null,
  maxUpscaleFactor: number,
  coverAspectMismatchThreshold: number,
  naturalSize?: ImageNaturalSize,
): MainImageFitResult {
  if (!autoFitImageToFrame) {
    return {
      style: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" },
      mode: "contain",
    };
  }

  if (!frameSize || !naturalSize || naturalSize.width <= 0 || naturalSize.height <= 0) {
    return {
      style: { width: "100%", height: "100%", objectFit: "contain" },
      mode: "contain",
    };
  }

  if (frameSize.width <= 0 || frameSize.height <= 0) {
    return {
      style: { width: "100%", height: "100%", objectFit: "contain" },
      mode: "contain",
    };
  }

  const containScale = Math.min(frameSize.width / naturalSize.width, frameSize.height / naturalSize.height);
  const imageAspectRatio = naturalSize.width / naturalSize.height;
  const frameAspectRatio = frameSize.width / frameSize.height;
  const aspectRatioMismatch = Math.abs(imageAspectRatio - frameAspectRatio) / frameAspectRatio;

  if (containScale > maxUpscaleFactor) {
    return {
      style: {
        width: `${Math.round(naturalSize.width * maxUpscaleFactor)}px`,
        height: `${Math.round(naturalSize.height * maxUpscaleFactor)}px`,
        objectFit: "contain",
      },
      mode: "capped-contain",
      containScale,
      aspectRatioMismatch,
      naturalWidth: naturalSize.width,
      naturalHeight: naturalSize.height,
    };
  }

  if (aspectRatioMismatch < coverAspectMismatchThreshold) {
    return {
      style: { width: "100%", height: "100%", objectFit: "cover" },
      mode: "cover",
      containScale,
      aspectRatioMismatch,
      naturalWidth: naturalSize.width,
      naturalHeight: naturalSize.height,
    };
  }

  return {
    style: { width: "100%", height: "100%", objectFit: "contain" },
    mode: "contain",
    containScale,
    aspectRatioMismatch,
    naturalWidth: naturalSize.width,
    naturalHeight: naturalSize.height,
  };
}

export function resolveEffectiveNaturalSize(
  item: MediaSwiperViewerItem,
  loadedNaturalSize?: ImageNaturalSize,
): ImageNaturalSize | undefined {
  const metadataWidth = typeof item.width === "number" && item.width > 0 ? item.width : 0;
  const metadataHeight = typeof item.height === "number" && item.height > 0 ? item.height : 0;
  const loadedWidth = loadedNaturalSize?.width ?? 0;
  const loadedHeight = loadedNaturalSize?.height ?? 0;

  const width = Math.max(metadataWidth, loadedWidth);
  const height = Math.max(metadataHeight, loadedHeight);

  if (!width || !height) {
    return undefined;
  }

  return { width, height };
}

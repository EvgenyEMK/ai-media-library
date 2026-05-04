import type { DragEvent, MutableRefObject } from "react";

/** Semi-transparent drag preview (browser default is often ~35–45% and reads as “nearly invisible”). */
export const REORDER_DRAG_PREVIEW_OPACITY = 0.78;

const PREVIEW_BORDER_CSS = "3px solid #ffffff";
const BORDER_LINE_WIDTH = 3;

function trySetDragImageFromDecodedImage(
  dataTransfer: DataTransfer,
  sourceImg: HTMLImageElement,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
): boolean {
  if (!sourceImg.complete || sourceImg.naturalWidth === 0) {
    return false;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return false;
  }
  ctx.clearRect(0, 0, width, height);
  ctx.globalAlpha = REORDER_DRAG_PREVIEW_OPACITY;
  ctx.drawImage(sourceImg, 0, 0, width, height);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = BORDER_LINE_WIDTH;
  ctx.strokeRect(
    BORDER_LINE_WIDTH / 2,
    BORDER_LINE_WIDTH / 2,
    width - BORDER_LINE_WIDTH,
    height - BORDER_LINE_WIDTH,
  );
  dataTransfer.setDragImage(canvas, offsetX, offsetY);
  return true;
}

export function cleanupReorderDragPreview(ghostRef: MutableRefObject<HTMLDivElement | null>): void {
  const ghost = ghostRef.current;
  if (ghost?.parentNode) {
    ghost.parentNode.removeChild(ghost);
  }
  ghostRef.current = null;
}

export interface ReorderDragPreviewFallback {
  imageUrl: string | null | undefined;
  mediaType: "image" | "video";
}

/**
 * Custom drag image: semi-transparent + white border. Uses a canvas when the card’s
 * {@link HTMLImageElement} is decoded (reliable in Chromium/Electron); otherwise a DOM ghost.
 *
 * **Important:** Thumbnail `<img>` / `<video>` must use `draggable={false}` when the card is
 * draggable for reorder; otherwise the browser’s native image drag ghost overrides
 * `setDragImage`.
 */
export function installReorderDragPreview(
  event: DragEvent<HTMLDivElement>,
  card: HTMLElement,
  ghostRef: MutableRefObject<HTMLDivElement | null>,
  fallback?: ReorderDragPreviewFallback,
): void {
  const dataTransfer = event.dataTransfer;
  if (!dataTransfer) {
    return;
  }
  cleanupReorderDragPreview(ghostRef);

  const rect = card.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const offsetX = Math.min(width, Math.max(0, Math.round(event.clientX - rect.left)));
  const offsetY = Math.min(height, Math.max(0, Math.round(event.clientY - rect.top)));

  const sourceImg = card.querySelector("img");
  if (sourceImg?.src && trySetDragImageFromDecodedImage(dataTransfer, sourceImg, width, height, offsetX, offsetY)) {
    return;
  }

  const ghost = document.createElement("div");
  ghost.setAttribute("data-emk-reorder-drag-preview", "true");
  ghost.style.position = "fixed";
  ghost.style.left = "-99999px";
  ghost.style.top = "0";
  ghost.style.width = `${width}px`;
  ghost.style.height = `${height}px`;
  ghost.style.opacity = String(REORDER_DRAG_PREVIEW_OPACITY);
  ghost.style.border = PREVIEW_BORDER_CSS;
  ghost.style.borderRadius = "8px";
  ghost.style.overflow = "hidden";
  ghost.style.boxSizing = "border-box";
  ghost.style.pointerEvents = "none";
  ghost.style.zIndex = "2147483647";
  ghost.style.backgroundColor = "#0f172a";

  const sourceVideo = card.querySelector("video");
  if (sourceImg?.src) {
    const img = document.createElement("img");
    img.src = sourceImg.src;
    img.alt = "";
    img.draggable = false;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.display = "block";
    img.style.opacity = "1";
    ghost.appendChild(img);
  } else if (sourceVideo?.src) {
    const video = document.createElement("video");
    video.src = sourceVideo.src;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = "cover";
    video.style.display = "block";
    video.style.opacity = "1";
    ghost.appendChild(video);
  } else if (fallback?.imageUrl) {
    const img = document.createElement("img");
    img.src = fallback.imageUrl;
    img.alt = "";
    img.draggable = false;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.display = "block";
    img.style.opacity = "1";
    ghost.appendChild(img);
  } else {
    ghost.style.display = "flex";
    ghost.style.alignItems = "center";
    ghost.style.justifyContent = "center";
    ghost.style.color = "#e2e8f0";
    ghost.style.fontSize = "14px";
    ghost.textContent = fallback?.mediaType === "video" ? "Video" : "Preview unavailable";
  }

  document.body.appendChild(ghost);
  ghostRef.current = ghost;
  dataTransfer.setDragImage(ghost, offsetX, offsetY);
}

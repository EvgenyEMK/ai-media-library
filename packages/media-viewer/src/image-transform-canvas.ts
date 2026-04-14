export function normalizeCropBox(cropBox: {
  x: number;
  y: number;
  width: number;
  height: number;
} | null): { x: number; y: number; width: number; height: number } | null {
  if (!cropBox) return null;
  if (!Number.isFinite(cropBox.width) || !Number.isFinite(cropBox.height)) return null;
  if (cropBox.width <= 0 || cropBox.height <= 0) return null;

  const x = Math.min(1, Math.max(0, cropBox.x));
  const y = Math.min(1, Math.max(0, cropBox.y));
  const right = Math.min(1, Math.max(0, cropBox.x + cropBox.width));
  const bottom = Math.min(1, Math.max(0, cropBox.y + cropBox.height));
  const width = right - x;
  const height = bottom - y;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

export function drawRotatedImage(
  image: HTMLImageElement,
  width: number,
  height: number,
  angle: 90 | 180 | 270 | null,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  if (angle === 90 || angle === 270) {
    canvas.width = height;
    canvas.height = width;
  } else {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context unavailable");
  }

  // Use explicit transform matrices to avoid ambiguity in angle direction.
  if (angle === 90) {
    ctx.setTransform(0, 1, -1, 0, canvas.width, 0);
  } else if (angle === 180) {
    ctx.setTransform(-1, 0, 0, -1, canvas.width, canvas.height);
  } else if (angle === 270) {
    ctx.setTransform(0, -1, 1, 0, 0, canvas.height);
  } else {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
}

export function drawCroppedImage(
  sourceCanvas: HTMLCanvasElement,
  cropBox: { x: number; y: number; width: number; height: number } | null,
): HTMLCanvasElement {
  if (!cropBox) return sourceCanvas;

  const sourceWidth = sourceCanvas.width;
  const sourceHeight = sourceCanvas.height;
  const sx = Math.max(0, Math.min(sourceWidth - 1, Math.round(cropBox.x * sourceWidth)));
  const sy = Math.max(0, Math.min(sourceHeight - 1, Math.round(cropBox.y * sourceHeight)));
  const ex = Math.max(sx + 1, Math.min(sourceWidth, Math.round((cropBox.x + cropBox.width) * sourceWidth)));
  const ey = Math.max(sy + 1, Math.min(sourceHeight, Math.round((cropBox.y + cropBox.height) * sourceHeight)));
  const sw = ex - sx;
  const sh = ey - sy;
  if (sw <= 0 || sh <= 0) {
    throw new Error("Invalid crop bounds");
  }

  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = sw;
  croppedCanvas.height = sh;
  const croppedCtx = croppedCanvas.getContext("2d");
  if (!croppedCtx) {
    throw new Error("Canvas context unavailable");
  }
  croppedCtx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return croppedCanvas;
}

export function drawFlippedImage(
  sourceCanvas: HTMLCanvasElement,
  flipVertical: boolean,
): HTMLCanvasElement {
  if (!flipVertical) {
    return sourceCanvas;
  }
  const flippedCanvas = document.createElement("canvas");
  flippedCanvas.width = sourceCanvas.width;
  flippedCanvas.height = sourceCanvas.height;
  const ctx = flippedCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context unavailable");
  }
  ctx.setTransform(1, 0, 0, -1, 0, sourceCanvas.height);
  ctx.drawImage(sourceCanvas, 0, 0);
  return flippedCanvas;
}

export function canvasToObjectUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to convert canvas to blob"));
          return;
        }
        resolve(URL.createObjectURL(blob));
      },
      "image/jpeg",
      0.92,
    );
  });
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = url;
  });
}

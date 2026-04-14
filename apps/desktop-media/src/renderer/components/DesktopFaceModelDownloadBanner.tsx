import type { ReactElement } from "react";

interface DesktopFaceModelDownloadBannerProps {
  message: string;
  filename: string | null;
  percent: number | null;
  downloadedBytes: number | null;
  totalBytes: number | null;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "?";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export function DesktopFaceModelDownloadBanner({
  message,
  filename,
  percent,
  downloadedBytes,
  totalBytes,
}: DesktopFaceModelDownloadBannerProps): ReactElement {
  return (
    <div
      className="flex flex-col gap-2 border-b border-emerald-800/60 bg-gradient-to-r from-[#15261f] to-secondary px-4 py-2.5"
      role="status"
    >
      <div className="flex flex-col gap-1 text-[13px]">
        <strong className="text-[#c9f0dc]">{message}</strong>
        <span>
          {filename ? `File: ${filename}` : "Preparing model download..."}
          {" · "}
          {percent !== null ? `${percent}%` : "estimating"}
          {" · "}
          {formatBytes(downloadedBytes)}
          {totalBytes !== null ? ` / ${formatBytes(totalBytes)}` : ""}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#20293d]" aria-hidden="true">
        <div
          className="h-full bg-[hsl(var(--success))] transition-[width] duration-100 ease-linear"
          style={{ width: `${Math.max(0, Math.min(100, percent ?? 5))}%` }}
        />
      </div>
    </div>
  );
}

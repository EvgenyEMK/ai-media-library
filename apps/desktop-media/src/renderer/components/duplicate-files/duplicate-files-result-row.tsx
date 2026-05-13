import type { ReactElement } from "react";
import type { DateDisplayFormat } from "@emk/shared-contracts";
import { Check } from "lucide-react";
import type {
  DesktopPhotoTakenPrecision,
  FolderDuplicateScanDuplicateEntry,
  FolderDuplicateScanRow,
} from "../../../shared/ipc";
import { toFileUrl } from "../face-cluster-utils";
import { cn } from "../../lib/cn";
import {
  formatComparablePathForDisplay,
  formatSelectedColumnFolderLine,
  type PathDisplayStyle,
  splitFileNameAndComparableParent,
} from "../../lib/duplicate-files-display-paths";
import { parentFolderPath } from "../../lib/duplicate-files-folder-scope";
import { comparableFilePath } from "../../lib/media-metadata-lookup";
import { formatPhotoTakenListDateOnly } from "../../lib/photo-date-format";

function formatByteSize(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function rowDisplayDateOnly(
  photoTakenAt: string | null,
  photoTakenPrecision: string | null,
  fileMtimeMs: number | null,
  dateFormat: DateDisplayFormat,
): string {
  return formatPhotoTakenListDateOnly(
    photoTakenAt,
    null,
    photoTakenPrecision as DesktopPhotoTakenPrecision | null,
    dateFormat,
    fileMtimeMs,
  );
}

function inferMediaTypeFromPath(filePath: string): "image" | "video" {
  return /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(filePath) ? "video" : "image";
}

function fileBasenameCompat(path: string): string {
  const n = comparableFilePath(path);
  const i = n.lastIndexOf("/");
  return i >= 0 ? n.slice(i + 1) : n;
}

function fileBasenamesDifferCaseInsensitive(a: string, b: string): boolean {
  return fileBasenameCompat(a).toLowerCase() !== fileBasenameCompat(b).toLowerCase();
}

function renderThumbnail(imageUrl: string | undefined, title: string, mediaType: "image" | "video"): ReactElement {
  if (!imageUrl) {
    return (
      <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded bg-muted text-center text-xs text-muted-foreground">
        Preview unavailable
      </div>
    );
  }
  if (mediaType === "video") {
    return (
      <video
        className="h-36 w-36 shrink-0 rounded object-cover"
        src={imageUrl}
        muted
        preload="metadata"
        playsInline
      />
    );
  }
  return (
    <img
      className="h-36 w-36 shrink-0 rounded object-cover"
      src={imageUrl}
      alt={title}
      loading="lazy"
      decoding="async"
    />
  );
}

function ToDeleteCheckbox({
  checked,
  markKey,
  onToggle,
  className,
}: {
  checked: boolean;
  markKey: string;
  onToggle: (key: string, next: boolean) => void;
  className?: string;
}): ReactElement {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      onClick={() => {
        onToggle(markKey, !checked);
      }}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
          checked
            ? "border-destructive bg-destructive text-destructive-foreground"
            : "border-border bg-background",
        )}
        aria-hidden="true"
      >
        {checked ? <Check className="size-4" strokeWidth={3} aria-hidden="true" /> : null}
      </span>
      <span className={cn("text-sm", checked ? "font-medium text-destructive" : "text-muted-foreground")}>To delete</span>
    </button>
  );
}

function duplicateFolderLineDisplay(sourcePath: string, pathStyle: PathDisplayStyle): string {
  return formatComparablePathForDisplay(parentFolderPath(sourcePath), pathStyle);
}

function DuplicateSideBlock({
  filePath,
  byteSize,
  photoTakenAt,
  photoTakenPrecision,
  fileMtimeMs,
  dateFormat,
  pathStyle,
  scanRootComparable,
  markKey,
  checked,
  onToggleMark,
  variant,
  scopedPathForNameCompare,
  showWeakDuplicateNote,
}: {
  filePath: string;
  byteSize: number | null;
  photoTakenAt: string | null;
  photoTakenPrecision: string | null;
  fileMtimeMs: number | null;
  dateFormat: DateDisplayFormat;
  pathStyle: PathDisplayStyle;
  scanRootComparable: string;
  markKey: string;
  checked: boolean;
  onToggleMark: (key: string, next: boolean) => void;
  variant: "scoped" | "duplicate";
  scopedPathForNameCompare?: string;
  showWeakDuplicateNote?: boolean;
}): ReactElement {
  const { fileName } = splitFileNameAndComparableParent(filePath);
  const folderLine =
    variant === "scoped"
      ? formatSelectedColumnFolderLine(filePath, scanRootComparable, pathStyle)
      : duplicateFolderLineDisplay(filePath, pathStyle);
  const nameDiffers =
    variant === "duplicate" &&
    scopedPathForNameCompare != null &&
    fileBasenamesDifferCaseInsensitive(scopedPathForNameCompare, filePath);

  return (
    <div className="min-w-0">
      <p
        className={cn(
          "break-all text-sm",
          nameDiffers
            ? "font-medium text-amber-600 dark:text-amber-400"
            : variant === "duplicate"
              ? "text-muted-foreground"
              : "text-foreground",
        )}
        title={fileName}
      >
        {fileName}
      </p>
      {nameDiffers ? (
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Different file name</p>
      ) : null}
      {folderLine ? (
        <p
          className={cn(
            "mt-1 break-all text-sm",
            variant === "duplicate" ? "font-semibold text-foreground" : "text-muted-foreground",
          )}
          title={folderLine}
        >
          {folderLine}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">
        {formatByteSize(byteSize)} · {rowDisplayDateOnly(photoTakenAt, photoTakenPrecision, fileMtimeMs, dateFormat)}
      </p>
      {showWeakDuplicateNote ? (
        <p className="mt-3 text-xs font-medium leading-snug text-amber-600 dark:text-amber-400">
          Duplicate based on file name, size and date. No content hash data
        </p>
      ) : null}
      <ToDeleteCheckbox
        checked={checked}
        markKey={markKey}
        onToggle={onToggleMark}
        className={showWeakDuplicateNote ? "mt-3" : "mt-5"}
      />
    </div>
  );
}

function DuplicateEntryBlock({
  dup,
  dateFormat,
  pathStyle,
  scanRootComparable,
  scopedPath,
  markedForDelete,
  onToggleMark,
  showWeakDuplicateNote,
}: {
  dup: FolderDuplicateScanDuplicateEntry;
  dateFormat: DateDisplayFormat;
  pathStyle: PathDisplayStyle;
  scanRootComparable: string;
  scopedPath: string;
  markedForDelete: ReadonlySet<string>;
  onToggleMark: (key: string, next: boolean) => void;
  showWeakDuplicateNote?: boolean;
}): ReactElement {
  const dupKey = `dup:${dup.mediaItemId}`;
  return (
    <DuplicateSideBlock
      filePath={dup.sourcePath}
      byteSize={dup.byteSize}
      photoTakenAt={dup.photoTakenAt}
      photoTakenPrecision={dup.photoTakenPrecision}
      fileMtimeMs={dup.fileMtimeMs}
      dateFormat={dateFormat}
      pathStyle={pathStyle}
      scanRootComparable={scanRootComparable}
      markKey={dupKey}
      checked={markedForDelete.has(dupKey)}
      onToggleMark={onToggleMark}
      variant="duplicate"
      scopedPathForNameCompare={scopedPath}
      showWeakDuplicateNote={showWeakDuplicateNote}
    />
  );
}

export function DuplicateResultRow({
  row,
  dateFormat,
  scanRootComparable,
  pathStyle,
  markedForDelete,
  onToggleMark,
}: {
  row: FolderDuplicateScanRow;
  dateFormat: DateDisplayFormat;
  scanRootComparable: string;
  pathStyle: PathDisplayStyle;
  markedForDelete: ReadonlySet<string>;
  onToggleMark: (key: string, next: boolean) => void;
}): ReactElement {
  const mediaType = inferMediaTypeFromPath(row.scopedPath);
  const thumbUrl = toFileUrl(row.scopedPath);
  const scopedKey = `scoped:${row.mediaItemId}`;
  const weakDuplicateNote = (row.duplicateMatchBasis ?? "content-hash") === "weak-metadata";

  return (
    <div
      className={cn(
        "grid gap-3 rounded-lg border border-border bg-card/40 p-3",
        "grid-cols-[144px_1fr_1fr] max-lg:grid-cols-1 max-lg:gap-4",
      )}
    >
      <div className="flex justify-center lg:justify-start">{renderThumbnail(thumbUrl, row.scopedPath, mediaType)}</div>

      <div className="min-w-0 border-t border-border pt-3 lg:border-t-0 lg:pt-0">
        <DuplicateSideBlock
          filePath={row.scopedPath}
          byteSize={row.byteSize}
          photoTakenAt={row.photoTakenAt}
          photoTakenPrecision={row.photoTakenPrecision}
          fileMtimeMs={row.fileMtimeMs}
          dateFormat={dateFormat}
          pathStyle={pathStyle}
          scanRootComparable={scanRootComparable}
          markKey={scopedKey}
          checked={markedForDelete.has(scopedKey)}
          onToggleMark={onToggleMark}
          variant="scoped"
          showWeakDuplicateNote={weakDuplicateNote}
        />
      </div>

      <div className="min-w-0 space-y-3 border-t border-border pt-3 lg:border-t-0 lg:pt-0">
        {row.duplicates.length === 1 ? (
          <DuplicateEntryBlock
            dup={row.duplicates[0]!}
            dateFormat={dateFormat}
            pathStyle={pathStyle}
            scanRootComparable={scanRootComparable}
            scopedPath={row.scopedPath}
            markedForDelete={markedForDelete}
            onToggleMark={onToggleMark}
            showWeakDuplicateNote={weakDuplicateNote}
          />
        ) : (
          <ul className="space-y-4">
            {row.duplicates.map((dup) => (
              <li key={dup.mediaItemId} className="rounded-md border border-border/60 bg-muted/20 p-2">
                <DuplicateEntryBlock
                  dup={dup}
                  dateFormat={dateFormat}
                  pathStyle={pathStyle}
                  scanRootComparable={scanRootComparable}
                  scopedPath={row.scopedPath}
                  markedForDelete={markedForDelete}
                  onToggleMark={onToggleMark}
                  showWeakDuplicateNote={weakDuplicateNote}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  FaceHoverPhotoPreviewLayer,
  getFaceHoverPreviewOuterWidth,
} from "./face-hover-photo-preview";

export interface PeopleWorkspaceTag {
  id: string;
  label: string;
}

export interface PeopleWorkspaceFaceMatch {
  id: string;
  backgroundStyle: CSSProperties;
  previewStyle?: CSSProperties;
  previewImageSrc?: string;
  previewImageWidth?: number | null;
  previewImageHeight?: number | null;
  title: string;
  subtitle?: string;
  confidenceLabel?: string;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
  onOpenPhoto?: () => void;
}

function ChevronPageLeftIcon(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronPageRightIcon(): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export interface PeopleWorkspaceTaggedFace {
  id: string;
  backgroundStyle: CSSProperties;
  previewStyle?: CSSProperties;
  previewImageSrc?: string;
  previewImageWidth?: number | null;
  previewImageHeight?: number | null;
  subtitle?: string;
  onOpenPhoto?: () => void;
}

interface PeopleFaceWorkspaceProps {
  title: string;
  description: string;
  refreshLabel: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  tagsHeading: string;
  tags: PeopleWorkspaceTag[];
  selectedTagId: string | null;
  onTagSelect: (tagId: string) => void;
  emptyTagsLabel: string;
  taggedFacesHeading?: string;
  taggedFaces?: PeopleWorkspaceTaggedFace[];
  /** When true, show a loading state for the tagged-faces thumbnail grid (e.g. after selecting a person). */
  isTaggedFacesLoading?: boolean;
  emptyTaggedFacesLabel?: string;
  /** When set, paginate tagged faces with prev/next instead of “Show all” (e.g. 25 = 5×5). */
  taggedFacesPageSize?: number;
  matchesHeading: string;
  matchesCountLabel: string;
  matches: PeopleWorkspaceFaceMatch[];
  matchesContent?: ReactElement | null;
  emptyMatchesLabel: string;
  errorMessage: string | null;
  headerActions?: ReactElement | null;
  /** Inline with tag chips in one wrapping row (e.g. name filter + show/hide). */
  tagsToolbar?: ReactNode;
}

export type PeopleWorkspaceOpenFacePhotoFn = (args: {
  sourcePath: string;
  imageWidth?: number | null;
  imageHeight?: number | null;
  mediaItemId?: string | null;
}) => void;

type PreviewSide = "left" | "right";

interface HoverPreviewThumbProps {
  thumbnailStyle: CSSProperties;
  previewStyle?: CSSProperties;
  previewImageSrc?: string;
  previewImageWidth?: number | null;
  previewImageHeight?: number | null;
  sizeClassName: string;
  ariaLabel: string;
  subtitle?: string;
  onOpenPhoto?: () => void;
}

function HoverPreviewThumb({
  thumbnailStyle,
  previewStyle,
  previewImageSrc,
  previewImageWidth,
  previewImageHeight,
  sizeClassName,
  ariaLabel,
  subtitle,
  onOpenPhoto,
}: HoverPreviewThumbProps): ReactElement {
  const [showPreview, setShowPreview] = useState(false);
  const [previewSide, setPreviewSide] = useState<PreviewSide>("right");

  const hasHoverPreview = Boolean(previewImageSrc || previewStyle);

  const handleMouseEnter = (event: MouseEvent<HTMLDivElement>) => {
    if (!hasHoverPreview) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const gap = 12;
    const previewWidth = previewImageSrc
      ? getFaceHoverPreviewOuterWidth(previewImageWidth, previewImageHeight)
      : 432 + 8;
    const canShowRight = rect.right + gap + previewWidth <= viewportWidth;
    setPreviewSide(canShowRight ? "right" : "left");
    setShowPreview(true);
  };

  const thumb = (
    <div
      className={`${sizeClassName} rounded-lg border border-border bg-muted`}
      style={thumbnailStyle}
      role="img"
      aria-label={ariaLabel}
    />
  );

  return (
    <div
      className="group relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowPreview(false)}
    >
      {onOpenPhoto ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenPhoto();
          }}
          className="relative block w-full cursor-pointer border-0 bg-transparent p-0 text-left"
          aria-label={`Open photo: ${ariaLabel}`}
        >
          {thumb}
        </button>
      ) : (
        thumb
      )}
      {previewImageSrc ? (
        <FaceHoverPhotoPreviewLayer
          imageSrc={previewImageSrc}
          imageWidth={previewImageWidth}
          imageHeight={previewImageHeight}
          show={showPreview}
          side={previewSide}
        />
      ) : previewStyle && showPreview ? (
        <div
          className={`pointer-events-none absolute top-1/2 z-40 hidden -translate-y-1/2 group-hover:block ${
            previewSide === "right" ? "left-full ml-3" : "right-full mr-3"
          }`}
        >
          <div
            className="box-border rounded-lg border-4 border-white bg-muted shadow-xl"
            style={{ width: 432 + 8, height: 432 + 8 }}
          >
            <div
              className="h-[432px] w-[432px] rounded-sm bg-cover bg-center"
              style={previewStyle}
              role="img"
              aria-label={ariaLabel}
            />
          </div>
        </div>
      ) : null}
      {subtitle ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 truncate rounded-b-lg bg-black/60 px-1 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

export function PeopleFaceWorkspace({
  title,
  description,
  refreshLabel,
  isRefreshing,
  onRefresh,
  tagsHeading,
  tags,
  selectedTagId,
  onTagSelect,
  emptyTagsLabel,
  taggedFacesHeading,
  taggedFaces,
  isTaggedFacesLoading = false,
  emptyTaggedFacesLabel,
  taggedFacesPageSize,
  matchesHeading,
  matchesCountLabel,
  matches,
  matchesContent,
  emptyMatchesLabel,
  errorMessage,
  headerActions,
  tagsToolbar,
}: PeopleFaceWorkspaceProps): ReactElement {
  const [showAllTaggedFaces, setShowAllTaggedFaces] = useState(false);
  const [taggedFacesPage, setTaggedFacesPage] = useState(0);

  useEffect(() => {
    setShowAllTaggedFaces(false);
    setTaggedFacesPage(0);
  }, [selectedTagId]);

  const usePagedTaggedFaces =
    typeof taggedFacesPageSize === "number" && taggedFacesPageSize > 0;
  /** Four rows of five thumbnails (sidebar layout) when not using paged mode. */
  const MAX_TAGGED_PREVIEW = 20;
  const taggedFaceCount = taggedFaces?.length ?? 0;
  const hasMoreTaggedFaces =
    Boolean(taggedFaces) && !usePagedTaggedFaces && taggedFaceCount > MAX_TAGGED_PREVIEW;
  const taggedTotalPages =
    usePagedTaggedFaces && taggedFacesPageSize
      ? Math.max(1, Math.ceil(taggedFaceCount / taggedFacesPageSize))
      : 1;
  const safeTaggedPage = Math.min(taggedFacesPage, taggedTotalPages - 1);

  const visibleTaggedFaces = (() => {
    if (!taggedFaces) return [];
    if (usePagedTaggedFaces && taggedFacesPageSize) {
      const start = safeTaggedPage * taggedFacesPageSize;
      return taggedFaces.slice(start, start + taggedFacesPageSize);
    }
    if (showAllTaggedFaces || !hasMoreTaggedFaces) return taggedFaces;
    return taggedFaces.slice(0, MAX_TAGGED_PREVIEW);
  })();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground md:text-base">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {headerActions}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-sm"
          >
            {isRefreshing ? "Loading..." : refreshLabel}
          </button>
        </div>
      </header>

      {errorMessage ? (
        <p className="rounded-md border border-destructive/60 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {tagsHeading}
        </h2>
        {tags.length === 0 ? (
          <div className="space-y-2">
            {tagsToolbar ? (
              <div className="flex flex-wrap items-center gap-2">{tagsToolbar}</div>
            ) : null}
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              {emptyTagsLabel}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {tagsToolbar}
            {tags.map((tag) => {
              const isActive = selectedTagId === tag.id;
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onTagSelect(tag.id)}
                  className={`inline-flex h-8 shrink-0 items-center rounded-md border px-3 text-sm transition ${
                    isActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {taggedFaces !== undefined && selectedTagId ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {taggedFacesHeading ?? "Tagged faces"}
          </h2>
          {isTaggedFacesLoading ? (
            <div
              className="flex min-h-[72px] items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-4 py-8"
              role="status"
              aria-live="polite"
              aria-busy="true"
              aria-label="Loading thumbnails"
            >
              <div
                className="size-8 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
                aria-hidden
              />
            </div>
          ) : taggedFaces.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              {emptyTaggedFacesLabel ?? "No faces tagged for this person yet."}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-5 gap-1">
                {visibleTaggedFaces.map((face) => (
                  <HoverPreviewThumb
                    key={face.id}
                    thumbnailStyle={face.backgroundStyle}
                    previewStyle={face.previewStyle}
                    previewImageSrc={face.previewImageSrc}
                    previewImageWidth={face.previewImageWidth}
                    previewImageHeight={face.previewImageHeight}
                    sizeClassName="aspect-square w-full"
                    ariaLabel="Photo preview"
                    subtitle={face.subtitle}
                    onOpenPhoto={face.onOpenPhoto}
                  />
                ))}
              </div>
              {hasMoreTaggedFaces && !showAllTaggedFaces ? (
                <button
                  type="button"
                  onClick={() => setShowAllTaggedFaces(true)}
                  className="w-full rounded-md border border-border bg-muted/30 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                >
                  Show all
                </button>
              ) : null}
              {usePagedTaggedFaces && taggedTotalPages > 1 ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    {taggedFaceCount === 0
                      ? "No faces"
                      : `${safeTaggedPage * taggedFacesPageSize! + 1}–${Math.min(
                          taggedFaceCount,
                          (safeTaggedPage + 1) * taggedFacesPageSize!,
                        )} of ${taggedFaceCount}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={safeTaggedPage <= 0}
                      onClick={() => setTaggedFacesPage((p) => Math.max(0, p - 1))}
                      className="inline-flex size-8 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-50"
                      aria-label="Previous page"
                      title="Previous page"
                    >
                      <ChevronPageLeftIcon />
                    </button>
                    <span className="tabular-nums text-muted-foreground">
                      Page {safeTaggedPage + 1} / {taggedTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safeTaggedPage >= taggedTotalPages - 1}
                      onClick={() =>
                        setTaggedFacesPage((p) => Math.min(taggedTotalPages - 1, p + 1))
                      }
                      className="inline-flex size-8 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-50"
                      aria-label="Next page"
                      title="Next page"
                    >
                      <ChevronPageRightIcon />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          {matchesHeading}{" "}
          <span className="font-normal text-muted-foreground">{matchesCountLabel}</span>
        </h2>

        {matchesContent ? (
          matchesContent
        ) : matches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">{emptyMatchesLabel}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {matches.map((match) => (
              <div
                key={match.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm"
              >
                <HoverPreviewThumb
                  thumbnailStyle={match.backgroundStyle}
                  previewStyle={match.previewStyle}
                  previewImageSrc={match.previewImageSrc}
                  previewImageWidth={match.previewImageWidth}
                  previewImageHeight={match.previewImageHeight}
                  sizeClassName="relative aspect-square w-full overflow-hidden"
                  ariaLabel="Photo preview"
                  onOpenPhoto={match.onOpenPhoto}
                />
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">{match.title}</div>
                  {match.subtitle ? (
                    <div className="truncate text-xs text-muted-foreground">{match.subtitle}</div>
                  ) : null}
                  {match.confidenceLabel ? (
                    <div className="text-xs text-muted-foreground">{match.confidenceLabel}</div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={match.onAction}
                  disabled={match.actionDisabled}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-sm"
                >
                  {match.actionLabel}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement,
} from "react";
import { PeopleTagsNameSearchRow } from "./people-tags-name-search-header";
import {
  getTaggedFacesTabVisibleTagIds,
  taggedFacesTabShouldOfferShowAll,
  type PersonTagListMeta,
} from "../lib/tagged-faces-tab-visible-tags";
import { Check, Loader2, X } from "lucide-react";
import { chunkArray } from "@emk/shared-contracts";
import {
  FaceHoverPhotoPreviewLayer,
  PeopleFaceWorkspace,
  getFaceHoverPreviewOuterWidth,
  type PeopleWorkspaceOpenFacePhotoFn,
  type PeopleWorkspaceTag,
  type PeopleWorkspaceTaggedFace,
} from "@emk/media-viewer";
import type { TaggedFaceInfo } from "../../shared/ipc";
import { FaceSelectionFooter } from "./FaceSelectionFooter";
import { computeFaceBackgroundCropStyle, toFileUrl } from "./face-cluster-utils";
import { PeoplePaginationBar } from "./people-pagination-bar";

const MATCH_GRID_COLS = 5;
const MATCH_FACE_ROWS_PER_PAGE = 5;
const MATCH_PAGE_SIZE = MATCH_GRID_COLS * MATCH_FACE_ROWS_PER_PAGE;

const UI_TEXT = {
  title: "Tagged faces",
  description:
    "Select a person tag and review related faces from your local database. Assigning a related face updates local tags.",
  refresh: "Refresh",
  tagsHeading: "Person tags",
  emptyTags: "Create person tags in photo face tags to start assigning related faces.",
  noFilterMatches: "No people match the filter.",
  matchesHeading: "Auto-detected matching faces",
  emptyMatches: "Select a person tag to see related faces.",
  loadError: "Failed to load people workspace.",
  nameFilterPlaceholder: "Name",
  showAllPersonTags: "Show all",
  hideAllPersonTags: "Hide all",
} as const;

interface SimilarFaceMatch {
  faceInstanceId: string;
  mediaItemId: string;
  sourcePath: string;
  tagId: string | null;
  tagLabel: string | null;
  score: number;
  bboxX: number;
  bboxY: number;
  bboxWidth: number;
  bboxHeight: number;
  imageWidth: number | null;
  imageHeight: number | null;
}

interface EmbeddingStats {
  totalFaces: number;
  withEmbeddings: number;
  pending: number;
}

type PreviewSide = "left" | "right";

function RelatedFaceThumb({
  match,
  isDeclined,
  hideDeclineButton,
  isAssigning,
  onDeclineToggle,
  onOpenPhoto,
}: {
  match: SimilarFaceMatch;
  isDeclined: boolean;
  hideDeclineButton: boolean;
  isAssigning: boolean;
  onDeclineToggle: () => void;
  onOpenPhoto?: () => void;
}): ReactElement {
  const [showPreview, setShowPreview] = useState(false);
  const [previewSide, setPreviewSide] = useState<PreviewSide>("right");
  const style = computeFaceBackgroundCropStyle({
    sourcePath: match.sourcePath,
    bboxX: match.bboxX,
    bboxY: match.bboxY,
    bboxWidth: match.bboxWidth,
    bboxHeight: match.bboxHeight,
    imageWidth: match.imageWidth,
    imageHeight: match.imageHeight,
  });
  const previewSrc = toFileUrl(match.sourcePath);

  const handleMouseEnter = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const previewWidth = getFaceHoverPreviewOuterWidth(match.imageWidth, match.imageHeight);
    const gap = 12;
    const canShowRight = rect.right + gap + previewWidth <= viewportWidth;
    setPreviewSide(canShowRight ? "right" : "left");
    setShowPreview(true);
  };

  const faceThumb = (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted ${
        isDeclined ? "opacity-20 blur-[1px]" : ""
      }`}
      style={style}
      role="img"
      aria-label="Detected face"
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
          aria-label="Open photo for this face"
        >
          {faceThumb}
        </button>
      ) : (
        faceThumb
      )}
      <FaceHoverPhotoPreviewLayer
        imageSrc={previewSrc}
        imageWidth={match.imageWidth}
        imageHeight={match.imageHeight}
        show={showPreview}
        side={previewSide}
      />
      <FaceSelectionFooter
        hidden={hideDeclineButton}
        isDeclined={isDeclined}
        isDisabled={isAssigning}
        onToggleDecline={onDeclineToggle}
        scorePercentLabel={`${(match.score * 100).toFixed(1)}%`}
      />
    </div>
  );
}

export function DesktopPeopleWorkspace({
  onOpenFacePhoto,
}: {
  onOpenFacePhoto: PeopleWorkspaceOpenFacePhotoFn;
}): ReactElement {
  const [tagsMeta, setTagsMeta] = useState<PersonTagListMeta[]>([]);
  const [nameFilter, setNameFilter] = useState("");
  const [tagsListExpanded, setTagsListExpanded] = useState(false);
  const [lastSelectedNonPinnedIds, setLastSelectedNonPinnedIds] = useState<string[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [matches, setMatches] = useState<SimilarFaceMatch[]>([]);
  const [taggedFaces, setTaggedFaces] = useState<TaggedFaceInfo[]>([]);
  const [isTaggedFacesLoading, setIsTaggedFacesLoading] = useState(false);
  const taggedFacesLoadSeqRef = useRef(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [assigningFaceIds, setAssigningFaceIds] = useState<string[]>([]);
  const [declinedFaceIds, setDeclinedFaceIds] = useState<string[]>([]);
  const [acceptedFaceIds, setAcceptedFaceIds] = useState<string[]>([]);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [embeddingStats, setEmbeddingStats] = useState<EmbeddingStats | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [matchesListPage, setMatchesListPage] = useState(0);
  const [pendingAssignRowKey, setPendingAssignRowKey] = useState<string | null>(null);
  const [faceMatchThreshold, setFaceMatchThreshold] = useState(0.6);
  const [isRecomputingProfile, setIsRecomputingProfile] = useState(false);

  const loadTags = useCallback(async () => {
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const [personTags, stats, settings] = await Promise.all([
        window.desktopApi.listPersonTagsWithFaceCounts(),
        window.desktopApi.getEmbeddingStats(),
        window.desktopApi.getSettings(),
      ]);
      setFaceMatchThreshold(settings.faceDetection.faceRecognitionSimilarityThreshold);
      const meta: PersonTagListMeta[] = personTags.map((tag) => ({
        id: tag.id,
        label: tag.label,
        pinned: tag.pinned,
        taggedFaceCount: tag.taggedFaceCount,
      }));
      setTagsMeta(meta);
      setEmbeddingStats(stats);
      if (!selectedTagId && meta.length > 0) {
        setSelectedTagId(meta[0].id);
      }
      if (selectedTagId && !meta.some((tag) => tag.id === selectedTagId)) {
        setSelectedTagId(meta.length > 0 ? meta[0].id : null);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : UI_TEXT.loadError);
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedTagId]);

  const loadTaggedFaces = useCallback(async (tagId: string | null) => {
    if (!tagId) {
      taggedFacesLoadSeqRef.current += 1;
      setTaggedFaces([]);
      setIsTaggedFacesLoading(false);
      return;
    }
    const seq = (taggedFacesLoadSeqRef.current += 1);
    setIsTaggedFacesLoading(true);
    try {
      const faces = await window.desktopApi.listFacesForPerson(tagId);
      if (seq !== taggedFacesLoadSeqRef.current) {
        return;
      }
      setTaggedFaces(faces);
    } catch {
      if (seq !== taggedFacesLoadSeqRef.current) {
        return;
      }
      setTaggedFaces([]);
    } finally {
      if (seq === taggedFacesLoadSeqRef.current) {
        setIsTaggedFacesLoading(false);
      }
    }
  }, []);

  const loadMatches = useCallback(async (tagId: string | null) => {
    if (!tagId) {
      setMatches([]);
      return;
    }

    setErrorMessage(null);
    try {
      const relatedFaces = await window.desktopApi.findPersonMatches({
        tagId,
        threshold: faceMatchThreshold,
        limit: 0,
      });
      setMatches(relatedFaces);
      setDeclinedFaceIds([]);
      setAcceptedFaceIds([]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : UI_TEXT.loadError);
      setMatches([]);
    }
  }, [faceMatchThreshold]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  useEffect(() => {
    if (selectedTagId) {
      setTaggedFaces([]);
    }
    void loadTaggedFaces(selectedTagId);
  }, [loadTaggedFaces, selectedTagId]);

  useEffect(() => {
    void loadMatches(selectedTagId);
  }, [loadMatches, selectedTagId]);

  useEffect(() => {
    setMatchesListPage(0);
  }, [selectedTagId]);

  const nameFilterTrimmed = nameFilter.trim();

  const visibleTagIds = useMemo(
    () =>
      getTaggedFacesTabVisibleTagIds({
        allTags: tagsMeta,
        nameFilterTrimmed,
        tagsListExpanded,
        lastSelectedNonPinnedIds,
        selectedTagId,
      }),
    [tagsMeta, nameFilterTrimmed, tagsListExpanded, lastSelectedNonPinnedIds, selectedTagId],
  );

  const visibleTags = useMemo((): PeopleWorkspaceTag[] => {
    const byId = new Map(tagsMeta.map((t) => [t.id, t] as const));
    return visibleTagIds
      .map((id) => byId.get(id))
      .filter((t): t is PersonTagListMeta => Boolean(t))
      .map((t) => ({ id: t.id, label: t.label }));
  }, [visibleTagIds, tagsMeta]);

  const shouldShowShowAll = useMemo(
    () =>
      taggedFacesTabShouldOfferShowAll({
        allTags: tagsMeta,
        nameFilterTrimmed,
        tagsListExpanded,
        lastSelectedNonPinnedIds,
      }),
    [tagsMeta, nameFilterTrimmed, tagsListExpanded, lastSelectedNonPinnedIds],
  );

  const handleWorkspaceTagSelect = useCallback(
    (tagId: string) => {
      if (nameFilterTrimmed.length > 0) {
        const meta = tagsMeta.find((t) => t.id === tagId);
        setNameFilter("");
        if (meta && !meta.pinned) {
          setLastSelectedNonPinnedIds((prev) => [tagId, ...prev.filter((id) => id !== tagId)].slice(0, 3));
        }
      }
      setSelectedTagId((current) => (current === tagId ? null : tagId));
    },
    [nameFilterTrimmed, tagsMeta],
  );

  useEffect(() => {
    const pageSize = MATCH_PAGE_SIZE;
    const maxPage = Math.max(0, Math.ceil(matches.length / pageSize) - 1);
    if (matchesListPage > maxPage) {
      setMatchesListPage(maxPage);
    }
  }, [matches.length, matchesListPage]);

  const handleAssignFaces = async (rowIndex: number, faceInstanceIds: string[]) => {
    if (!selectedTagId) return;
    const uniqueFaceIds = Array.from(new Set(faceInstanceIds));
    if (uniqueFaceIds.length === 0) {
      return;
    }
    const rowKey = `${matchesListPage}-${rowIndex}`;
    setPendingAssignRowKey(rowKey);
    setAssigningFaceIds((current) => Array.from(new Set([...current, ...uniqueFaceIds])));
    setErrorMessage(null);
    try {
      const { assignedCount } = await window.desktopApi.assignPersonTagsToFaces(
        uniqueFaceIds,
        selectedTagId,
      );
      if (assignedCount > 0) {
        setAcceptedFaceIds((current) => Array.from(new Set([...current, ...uniqueFaceIds])));
        setMatches((prev) => prev.filter((m) => !uniqueFaceIds.includes(m.faceInstanceId)));
        await loadTaggedFaces(selectedTagId);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to assign person tag.");
    } finally {
      setPendingAssignRowKey(null);
      setAssigningFaceIds((current) =>
        current.filter((faceInstanceId) => !uniqueFaceIds.includes(faceInstanceId)),
      );
    }
  };

  const handleDeclineFaces = useCallback(
    async (faceInstanceIds: string[]) => {
      const uniqueFaceIds = Array.from(new Set(faceInstanceIds));
      if (uniqueFaceIds.length === 0) return;
      const acceptedSet = new Set(acceptedFaceIds);
      const faceIdsToUnassign = uniqueFaceIds.filter((id) => acceptedSet.has(id));
      if (faceIdsToUnassign.length === 0) return;

      setAssigningFaceIds((current) => Array.from(new Set([...current, ...faceIdsToUnassign])));
      setErrorMessage(null);
      try {
        for (const faceInstanceId of faceIdsToUnassign) {
          await window.desktopApi.clearPersonTagFromFace(faceInstanceId);
        }
        setAcceptedFaceIds((current) =>
          current.filter((faceInstanceId) => !faceIdsToUnassign.includes(faceInstanceId)),
        );
        await loadTaggedFaces(selectedTagId);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to clear person tag.");
      } finally {
        setAssigningFaceIds((current) =>
          current.filter((faceInstanceId) => !faceIdsToUnassign.includes(faceInstanceId)),
        );
      }
    },
    [acceptedFaceIds, loadTaggedFaces, selectedTagId],
  );

  const taggedFaceCards = useMemo<PeopleWorkspaceTaggedFace[]>(
    () =>
      taggedFaces.map((face) => ({
        id: face.faceInstanceId,
        backgroundStyle: computeFaceBackgroundCropStyle({
          sourcePath: face.sourcePath,
          bboxX: face.bboxX,
          bboxY: face.bboxY,
          bboxWidth: face.bboxWidth,
          bboxHeight: face.bboxHeight,
          imageWidth: face.imageWidth,
          imageHeight: face.imageHeight,
        }),
        previewImageSrc: toFileUrl(face.sourcePath),
        previewImageWidth: face.imageWidth,
        previewImageHeight: face.imageHeight,
        subtitle: face.sourcePath.split(/[\\/]/).pop() ?? face.sourcePath,
        onOpenPhoto: () =>
          onOpenFacePhoto({
            sourcePath: face.sourcePath,
            imageWidth: face.imageWidth,
            imageHeight: face.imageHeight,
            mediaItemId: face.mediaItemId,
          }),
      })),
    [taggedFaces, onOpenFacePhoto],
  );

  const matchesPageSlice = useMemo(
    () =>
      matches.slice(
        matchesListPage * MATCH_PAGE_SIZE,
        (matchesListPage + 1) * MATCH_PAGE_SIZE,
      ),
    [matches, matchesListPage],
  );
  const matchRows = useMemo(
    () => chunkArray(matchesPageSlice, MATCH_GRID_COLS),
    [matchesPageSlice],
  );

  const handleReprocess = async (): Promise<void> => {
    setIsReprocessing(true);
    setErrorMessage(null);
    try {
      await window.desktopApi.reprocessFaceCropsAndEmbeddings();
      await loadTags();
      await loadTaggedFaces(selectedTagId);
      await loadMatches(selectedTagId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to generate crops & embeddings.",
      );
    } finally {
      setIsReprocessing(false);
    }
  };

  const selectedTagLabel = tagsMeta.find((tag) => tag.id === selectedTagId)?.label ?? "None";
  const needsReprocessing =
    embeddingStats !== null && embeddingStats.pending > 0;
  const assigningFaceSet = useMemo(() => new Set(assigningFaceIds), [assigningFaceIds]);
  const declinedFaceSet = useMemo(() => new Set(declinedFaceIds), [declinedFaceIds]);
  const acceptedFaceSet = useMemo(() => new Set(acceptedFaceIds), [acceptedFaceIds]);
  const isAnyAssigning = assigningFaceIds.length > 0;

  const headerActionsElement =
    selectedTagId || needsReprocessing ? (
    <div className="flex flex-wrap items-center gap-2">
      {selectedTagId ? (
        <button
          type="button"
          onClick={() => {
            void (async () => {
              setIsRecomputingProfile(true);
              setErrorMessage(null);
              try {
                const result = await window.desktopApi.recomputePersonCentroid(selectedTagId);
                if (result.success) {
                  await loadMatches(selectedTagId);
                } else {
                  setErrorMessage(result.error);
                }
              } finally {
                setIsRecomputingProfile(false);
              }
            })();
          }}
          disabled={isRecomputingProfile || isRefreshing}
          title="Recompute this person’s face profile (centroid) from every face currently tagged for them, then reload similar faces below."
          className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"
        >
          {isRecomputingProfile ? "Recalculating…" : "Recalculate profile"}
        </button>
      ) : null}
      {needsReprocessing ? (
        <button
          type="button"
          onClick={() => void handleReprocess()}
          disabled={isReprocessing}
          title="Generate face embeddings for detected faces that don’t have a stored vector yet (missing or failed). Does not recompute person centroids unless you assign tags or use Recalculate profile."
          className="inline-flex h-9 items-center justify-center rounded-md border border-primary bg-primary/10 px-3 text-sm text-primary hover:bg-primary/20 disabled:opacity-50"
        >
          {isReprocessing
            ? "Processing..."
            : `Generate embeddings (${embeddingStats!.pending})`}
        </button>
      ) : null}
    </div>
  ) : null;

  const matchesContent = matches.length === 0 ? null : (
    <div className="space-y-4">
      {matchRows.map((row, rowIndex) => {
        const rowFaceIds = row.map((face) => face.faceInstanceId);
        const allDeclined = rowFaceIds.every((faceId) => declinedFaceSet.has(faceId));
        const assignableIds = rowFaceIds.filter((faceId) => !declinedFaceSet.has(faceId));
        const isAcceptedRow =
          assignableIds.length > 0 && assignableIds.every((faceId) => acceptedFaceSet.has(faceId));
        return (
          <div key={`match-row-${matchesListPage}-${rowIndex}`} className="flex items-start gap-3">
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  void handleAssignFaces(rowIndex, assignableIds);
                }}
                disabled={isAnyAssigning || assignableIds.length === 0}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-primary/20 disabled:opacity-50 ${
                  isAcceptedRow
                    ? "border-green-600 bg-green-100 text-green-700"
                    : "border-primary/60 bg-primary/10 text-primary"
                }`}
                aria-label="Assign row"
                title="Assign row"
              >
                {pendingAssignRowKey === `${matchesListPage}-${rowIndex}` ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : (
                  <Check className="size-5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeclinedFaceIds((current) => {
                    const next = new Set(current);
                    if (allDeclined) {
                      rowFaceIds.forEach((faceId) => next.delete(faceId));
                    } else {
                      rowFaceIds.forEach((faceId) => next.add(faceId));
                    }
                    return Array.from(next);
                  });
                  if (!allDeclined) {
                    void handleDeclineFaces(rowFaceIds);
                  }
                }}
                disabled={isAnyAssigning}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted disabled:opacity-50 ${
                  allDeclined
                    ? "border-destructive bg-destructive/15 text-destructive hover:bg-destructive/25"
                    : "border-border text-muted-foreground"
                }`}
                aria-label={allDeclined ? "Undo hide for row" : "Hide row from accept"}
                title={allDeclined ? "Undo hide for row" : "Hide row from accept"}
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {row.map((match) => (
                <RelatedFaceThumb
                  key={match.faceInstanceId}
                  match={match}
                  isDeclined={declinedFaceSet.has(match.faceInstanceId)}
                  hideDeclineButton={allDeclined}
                  isAssigning={assigningFaceSet.has(match.faceInstanceId) || isAnyAssigning}
                  onOpenPhoto={() =>
                    onOpenFacePhoto({
                      sourcePath: match.sourcePath,
                      imageWidth: match.imageWidth,
                      imageHeight: match.imageHeight,
                      mediaItemId: null,
                    })
                  }
                  onDeclineToggle={() => {
                    const isNowDeclined = !declinedFaceSet.has(match.faceInstanceId);
                    setDeclinedFaceIds((current) => {
                      const next = new Set(current);
                      if (next.has(match.faceInstanceId)) {
                        next.delete(match.faceInstanceId);
                      } else {
                        next.add(match.faceInstanceId);
                      }
                      return Array.from(next);
                    });
                    if (isNowDeclined) {
                      void handleDeclineFaces([match.faceInstanceId]);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
      <PeoplePaginationBar
        ariaLabel="Auto-detected similar faces pagination"
        currentPage={matchesListPage}
        totalItems={matches.length}
        pageSize={MATCH_PAGE_SIZE}
        disabled={isAnyAssigning}
        onPageChange={(next) => {
          setMatchesListPage(next);
          if (selectedTagId) {
            void window.desktopApi.refreshPersonSuggestionsForTag(selectedTagId);
          }
        }}
      />
    </div>
  );

  return (
    <PeopleFaceWorkspace
      title={UI_TEXT.title}
      description={UI_TEXT.description}
      refreshLabel={UI_TEXT.refresh}
      isRefreshing={isRefreshing}
      onRefresh={() => {
        void loadTags();
        void loadMatches(selectedTagId);
        void loadTaggedFaces(selectedTagId);
      }}
      tagsHeading={UI_TEXT.tagsHeading}
      tags={visibleTags}
      selectedTagId={selectedTagId}
      onTagSelect={handleWorkspaceTagSelect}
      emptyTagsLabel={
        tagsMeta.length > 0 && visibleTags.length === 0 && nameFilterTrimmed.length > 0
          ? UI_TEXT.noFilterMatches
          : UI_TEXT.emptyTags
      }
      tagsToolbar={
        tagsMeta.length > 0 ? (
          <PeopleTagsNameSearchRow
            value={nameFilter}
            onChange={setNameFilter}
            placeholder={UI_TEXT.nameFilterPlaceholder}
            trailingSlot={
              shouldShowShowAll || tagsListExpanded ? (
                <button
                  type="button"
                  onClick={() => setTagsListExpanded((expanded) => !expanded)}
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-border px-3 text-sm hover:bg-muted"
                >
                  {tagsListExpanded ? UI_TEXT.hideAllPersonTags : UI_TEXT.showAllPersonTags}
                </button>
              ) : null
            }
          />
        ) : null
      }
      taggedFacesHeading={
        isTaggedFacesLoading ? "Tagged faces" : `Tagged faces (${taggedFaces.length})`
      }
      taggedFaces={taggedFaceCards}
      isTaggedFacesLoading={isTaggedFacesLoading}
      emptyTaggedFacesLabel="No faces tagged for this person yet."
      taggedFacesPageSize={MATCH_PAGE_SIZE}
      matchesHeading={UI_TEXT.matchesHeading}
      matchesCountLabel={`${selectedTagLabel}: ${matches.length}`}
      matches={[]}
      matchesContent={matchesContent}
      emptyMatchesLabel={UI_TEXT.emptyMatches}
      errorMessage={errorMessage}
      headerActions={headerActionsElement}
    />
  );
}

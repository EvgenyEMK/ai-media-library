import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";
import { AlertCircle, Loader2, ScanFace, Tag, Trash2, UserPlus } from "lucide-react";
import { FaceTagPersonSuggestionRow, FaceTagsEntryCard } from "@emk/media-viewer";
import type { BeingBoundingBox } from "@emk/media-metadata-core";
import type {
  DesktopFaceInstance,
  DesktopFacePersonTagSuggestion,
  DesktopPersonTag,
} from "../../shared/ipc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";
import { useDesktopStore } from "../stores/desktop-store";
import { computeFaceBackgroundCropStyle } from "./face-cluster-utils";

const SELECT_NONE = "__none__";
const SELECT_CREATE = "__create__";

/** Same crop math as People sidebar (`computeFaceBackgroundCropStyle` + DB ref image size). */
function desktopFaceTagsTabThumbnailStyle(
  sourcePath: string,
  faceInstance: DesktopFaceInstance,
  fallbackImageWidth: number | null,
  fallbackImageHeight: number | null,
): CSSProperties | null {
  const bb = faceInstance.bounding_box;
  const bx = bb.x;
  const by = bb.y;
  const bw = bb.width;
  const bh = bb.height;
  if (bx == null || by == null || bw == null || bh == null) {
    return null;
  }
  return computeFaceBackgroundCropStyle({
    sourcePath,
    bboxX: bx,
    bboxY: by,
    bboxWidth: bw,
    bboxHeight: bh,
    imageWidth: faceInstance.ref_image_width ?? fallbackImageWidth,
    imageHeight: faceInstance.ref_image_height ?? fallbackImageHeight,
  });
}

function getCategoryLabel(category?: string | null): string | null {
  if (!category) return null;
  const map: Record<string, string> = { adult: "Adult", child: "Child", baby: "Baby" };
  return map[category.toLowerCase()] ?? category;
}

function getGenderLabel(gender?: string | null): string | null {
  if (!gender) return null;
  const map: Record<string, string> = { male: "Male", female: "Female", unknown: "Unknown", other: "Other" };
  return map[gender.toLowerCase()] ?? gender;
}

interface DesktopFaceTagsTabContentProps {
  mediaItemId: string | null;
  sourcePath: string;
  imageWidth: number | null;
  imageHeight: number | null;
  /** Canonical metadata order; use with `faceDisplayOrder` for list + overlay. */
  boundingBoxes: BeingBoundingBox[];
  /** Maps each displayed row index → canonical `boundingBoxes` index (largest face first). */
  faceDisplayOrder: number[];
  selectedIndex: number | null;
  onSelectIndex: (index: number) => void;
  onBoundingBoxesReplace: (boxes: BeingBoundingBox[]) => void;
  onRefreshMetadataBoxes: () => Promise<BeingBoundingBox[]>;
}

export function DesktopFaceTagsTabContent({
  mediaItemId,
  sourcePath,
  imageWidth,
  imageHeight,
  boundingBoxes,
  faceDisplayOrder,
  selectedIndex,
  onSelectIndex,
  onBoundingBoxesReplace,
  onRefreshMetadataBoxes,
}: DesktopFaceTagsTabContentProps): ReactElement {
  const faceDetectionSettings = useDesktopStore((s) => s.faceDetectionSettings);
  const [personTags, setPersonTags] = useState<DesktopPersonTag[]>([]);
  const [faceInstances, setFaceInstances] = useState<DesktopFaceInstance[]>([]);
  const [pendingFaceId, setPendingFaceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDetectingLocal, setIsDetectingLocal] = useState(false);
  const [createTagFaceInstance, setCreateTagFaceInstance] =
    useState<DesktopFaceInstance | null>(null);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [embeddingSuggestions, setEmbeddingSuggestions] = useState<
    Record<string, DesktopFacePersonTagSuggestion | null>
  >({});

  const embeddingSuggestionFaceKey = useMemo(() => {
    return faceInstances
      .filter((f) => !f.tag_id)
      .map((f) => f.id)
      .sort()
      .join("|");
  }, [faceInstances]);

  useEffect(() => {
    const ids = embeddingSuggestionFaceKey
      ? embeddingSuggestionFaceKey.split("|").filter(Boolean)
      : [];
    if (ids.length === 0) {
      setEmbeddingSuggestions({});
      return;
    }

    let cancelled = false;
    void (async () => {
      const next: Record<string, DesktopFacePersonTagSuggestion | null> = {};
      await Promise.all(
        ids.map(async (id) => {
          try {
            next[id] = await window.desktopApi.suggestPersonTagForFace({
              faceInstanceId: id,
            });
          } catch {
            next[id] = null;
          }
        }),
      );
      if (!cancelled) {
        setEmbeddingSuggestions(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [embeddingSuggestionFaceKey]);

  useEffect(() => {
    let mounted = true;
    void window.desktopApi.listPersonTags().then((tags) => {
      if (mounted) {
        setPersonTags(tags);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const resolveMediaItemId = useCallback(async (): Promise<string | null> => {
    if (mediaItemId) return mediaItemId;
    if (!sourcePath.trim()) return null;
    const byPath = await window.desktopApi.getMediaItemsByPaths([sourcePath]);
    return byPath[sourcePath]?.id ?? null;
  }, [mediaItemId, sourcePath]);

  const loadFaceInstances = useCallback(async () => {
    const id = await resolveMediaItemId();
    if (!id) {
      setFaceInstances([]);
      return;
    }
    const instances = await window.desktopApi.listFaceInstancesForMediaItem(id);
    setFaceInstances(instances);
  }, [resolveMediaItemId]);

  useEffect(() => {
    // Clear stale per-image state immediately on item switch. Without this,
    // a just-opened no-face image can briefly reuse previous image face rows
    // and synthesize overlays before the async DB fetch resolves.
    setFaceInstances([]);
    setEmbeddingSuggestions({});
    setPendingFaceId(null);
    setErrorMessage(null);
    void loadFaceInstances();
  }, [loadFaceInstances, mediaItemId, sourcePath]);

  useEffect(() => {
    if (faceInstances.length === 0 || boundingBoxes.length > 0) return;
    void onRefreshMetadataBoxes().then((boxes) => {
      if (boxes.length > 0 || faceInstances.length === 0) return;
      const synthesized: BeingBoundingBox[] = faceInstances.map((inst) => ({
        person_category: null,
        gender: null,
        person_bounding_box: undefined,
        person_face_bounding_box: {
          x: inst.bounding_box.x ?? undefined,
          y: inst.bounding_box.y ?? undefined,
          width: inst.bounding_box.width ?? undefined,
          height: inst.bounding_box.height ?? undefined,
          image_width: inst.ref_image_width ?? undefined,
          image_height: inst.ref_image_height ?? undefined,
        },
        provider_raw_bounding_box: undefined,
        azureFaceAttributes: null,
      }));
      onBoundingBoxesReplace(synthesized);
    });
  }, [faceInstances, boundingBoxes.length]);

  const faceIndexMap = useMemo(() => {
    const map = new Map<number, DesktopFaceInstance>();
    faceInstances.forEach((instance) => {
      map.set(instance.face_index, instance);
    });
    return map;
  }, [faceInstances]);

  const sortedFaceBoxes = useMemo(
    () => faceDisplayOrder.map((i) => boundingBoxes[i]),
    [boundingBoxes, faceDisplayOrder],
  );

  const handleAssignTag = async (faceInstance: DesktopFaceInstance | undefined, value: string) => {
    if (!faceInstance) {
      setErrorMessage("Face metadata is missing for this bounding box. Re-run detection.");
      return;
    }

    setErrorMessage(null);
    setPendingFaceId(faceInstance.id);
    try {
      const updated =
        value === SELECT_NONE
          ? await window.desktopApi.clearPersonTagFromFace(faceInstance.id)
          : await window.desktopApi.assignPersonTagToFace(faceInstance.id, value);
      if (!updated) {
        throw new Error("Failed to update face tag.");
      }
      setFaceInstances((current) =>
        current.map((instance) => (instance.id === updated.id ? updated : instance)),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update face tag.");
    } finally {
      setPendingFaceId(null);
    }
  };

  const handleCreateTag = async (faceInstance: DesktopFaceInstance | undefined) => {
    if (!faceInstance) {
      setErrorMessage("Face metadata is missing for this bounding box. Re-run detection.");
      return;
    }
    setErrorMessage(null);
    setCreateTagFaceInstance(faceInstance);
    setNewTagLabel("");
  };

  const handleSubmitCreateTag = async () => {
    if (!createTagFaceInstance) {
      return;
    }
    const label = newTagLabel.trim();
    if (!label) {
      setErrorMessage("Please enter a person tag name.");
      return;
    }

    setErrorMessage(null);
    setPendingFaceId(createTagFaceInstance.id);
    setIsCreatingTag(true);
    try {
      const newTag = await window.desktopApi.createPersonTag(label);
      setPersonTags((current) => [...current, newTag].sort((a, b) => a.label.localeCompare(b.label)));
      const updated = await window.desktopApi.assignPersonTagToFace(createTagFaceInstance.id, newTag.id);
      if (!updated) {
        throw new Error("Failed to assign new tag.");
      }
      setFaceInstances((current) =>
        current.map((instance) => (instance.id === updated.id ? updated : instance)),
      );
      setCreateTagFaceInstance(null);
      setNewTagLabel("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create person tag.");
    } finally {
      setIsCreatingTag(false);
      setPendingFaceId(null);
    }
  };

  const handleDeleteFace = async (faceInstance: DesktopFaceInstance | undefined) => {
    if (!faceInstance) {
      setErrorMessage("Face metadata is missing for this bounding box. Re-run detection.");
      return;
    }
    setErrorMessage(null);
    setPendingFaceId(faceInstance.id);
    try {
      const deleted = await window.desktopApi.deleteFaceInstance(faceInstance.id);
      if (!deleted) {
        throw new Error("Failed to delete face instance.");
      }

      setFaceInstances((current) =>
        current
          .filter((instance) => instance.id !== faceInstance.id)
          .map((instance) =>
            instance.face_index > faceInstance.face_index
              ? { ...instance, face_index: instance.face_index - 1 }
              : instance,
          ),
      );
      onBoundingBoxesReplace(boundingBoxes.filter((_box, i) => i !== faceInstance.face_index));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete face instance.");
    } finally {
      setPendingFaceId(null);
    }
  };

  const handleDetectFacesLocal = async () => {
    setErrorMessage(null);
    setIsDetectingLocal(true);
    try {
      const result = await window.desktopApi.detectFacesForMediaItem(sourcePath, faceDetectionSettings);
      await loadFaceInstances();
      const nextBoxes = await onRefreshMetadataBoxes();
      onBoundingBoxesReplace(nextBoxes);
      if (result.faceCount === 0) {
        setErrorMessage("No faces detected for this photo.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to detect faces.");
    } finally {
      setIsDetectingLocal(false);
    }
  };

  return (
    <div className="space-y-4">
      {errorMessage ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {createTagFaceInstance ? (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            Create a new person tag and assign it to the selected face.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={newTagLabel}
              onChange={(event) => setNewTagLabel(event.target.value)}
              placeholder="Enter person name..."
              className="sm:max-w-xs"
              autoFocus
            />
            <button
              type="button"
              className="inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-sm"
              onClick={() => void handleSubmitCreateTag()}
              disabled={isCreatingTag}
            >
              {isCreatingTag ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create and assign"
              )}
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center justify-center rounded-md border border-border px-3 text-sm"
              onClick={() => {
                setCreateTagFaceInstance(null);
                setNewTagLabel("");
              }}
              disabled={isCreatingTag}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {sortedFaceBoxes.length > 0 ? (
        <>
          <p className="text-sm text-muted-foreground">
            Click a face entry to highlight the corresponding bounding box on the photo.
          </p>

          {sortedFaceBoxes.map((box, displayIdx) => {
            const originalIndex = faceDisplayOrder[displayIdx];
            const faceInstance = faceIndexMap.get(originalIndex);
            const isPending = Boolean(faceInstance && pendingFaceId === faceInstance.id);
            const selectValue = faceInstance?.tag?.id ?? SELECT_NONE;
            const embeddingSuggestion =
              faceInstance && selectValue === SELECT_NONE
                ? embeddingSuggestions[faceInstance.id] ?? null
                : null;

            return (
              <FaceTagsEntryCard
                key={`${mediaItemId ?? sourcePath}-orig-${originalIndex}`}
                index={displayIdx}
                isSelected={selectedIndex === displayIdx}
                onSelect={onSelectIndex}
                thumbnailStyle={
                  faceInstance
                    ? desktopFaceTagsTabThumbnailStyle(
                        sourcePath,
                        faceInstance,
                        imageWidth,
                        imageHeight,
                      )
                    : null
                }
                controls={
                  <div
                    className="flex items-center gap-2"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Select
                      value={selectValue}
                      onValueChange={(value) => {
                        if (value === SELECT_CREATE) {
                          void handleCreateTag(faceInstance);
                          return;
                        }
                        void handleAssignTag(faceInstance, value);
                      }}
                      disabled={isPending}
                    >
                      <SelectTrigger size="sm" className="min-w-[200px] justify-between">
                        <SelectValue placeholder="Assign person" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SELECT_NONE}>Unassigned</SelectItem>
                        <SelectSeparator />
                        {personTags.map((tag) => (
                          <SelectItem key={tag.id} value={tag.id}>
                            {tag.label}
                          </SelectItem>
                        ))}
                        <SelectSeparator />
                        <SelectItem value={SELECT_CREATE}>
                          <div className="flex items-center gap-2">
                            <UserPlus className="size-4" />
                            Create new person tag...
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      className="inline-flex size-8 items-center justify-center rounded-md border border-border text-destructive hover:bg-muted disabled:opacity-50"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDeleteFace(faceInstance);
                      }}
                      disabled={isPending}
                      aria-label="Remove person tag from face"
                    >
                      {isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </button>
                  </div>
                }
                suggestionRow={
                  embeddingSuggestion && faceInstance ? (
                    <FaceTagPersonSuggestionRow
                      tagLabel={embeddingSuggestion.tagLabel}
                      similarityScore={embeddingSuggestion.score}
                      disabled={isPending}
                      onAssign={() => void handleAssignTag(faceInstance, embeddingSuggestion.tagId)}
                    />
                  ) : null
                }
                details={
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {getCategoryLabel(box.person_category) ? (
                      <div>{getCategoryLabel(box.person_category)}</div>
                    ) : null}
                    {box.gender ? <div>{getGenderLabel(box.gender)}</div> : null}
                  </div>
                }
              />
            );
          })}
        </>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          <Tag size={32} className="mx-auto mb-2 opacity-60" />
          <p>No faces detected for this media item yet.</p>
          <p className="mt-1 text-xs opacity-80">
            Run face detection to create face entries and assign tags.
          </p>
        </div>
      )}

      <div className="pt-2">
        <button
          type="button"
          onClick={() => void handleDetectFacesLocal()}
          disabled={isDetectingLocal}
          className="inline-flex w-full items-center justify-center rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground hover:bg-muted sm:w-auto"
        >
          {isDetectingLocal ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Detecting faces - local...
            </>
          ) : (
            <>
              <ScanFace className="mr-2 size-4" />
              Detect faces - local
            </>
          )}
        </button>
      </div>
    </div>
  );
}

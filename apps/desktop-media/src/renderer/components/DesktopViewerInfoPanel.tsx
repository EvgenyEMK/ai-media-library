import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  FaceBoundingBoxOverlay,
  getFaceTagsSortedBoxesAndOrder,
  PhotoWithInfoPanel,
  type FaceOverlayImageInfo,
} from "@emk/media-viewer";
import {
  getAdditionalTopLevelFields,
  getPeopleBoundingBoxes,
  normalizeMetadata,
  type BeingBoundingBox,
} from "@emk/media-metadata-core";
import { getCategoryLabel, getGenderLabel, toHeadlineLabel } from "../lib/label-formatters";
import { DesktopInfoSection, type DesktopInfoField } from "./DesktopInfoSection";
import { DesktopViewerInfoRatingRow } from "./DesktopViewerInfoRatingRow";
import { DesktopFaceTagsTabContent } from "./DesktopFaceTagsTabContent";
import type { DesktopViewerInfoPanelProps, DesktopViewerItem } from "../types/viewer-types";
import type { DesktopFaceInstance, DesktopMediaItemMetadata } from "../../shared/ipc";
import { formatPhotoTakenListLabel } from "../lib/photo-date-format";
import { useDesktopStore } from "../stores/desktop-store";

const UNKNOWN_TEXT_VALUES = new Set(["unknown", "n/a", "na", "null", "undefined"]);

function hasVisibleFieldValue(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized || UNKNOWN_TEXT_VALUES.has(normalized)) {
    return false;
  }
  return true;
}

/** Catalog country, state/province (`locationArea`), and city — pipe-separated, missing parts omitted. */
function formatCatalogLocationLine(metadata: DesktopMediaItemMetadata): string | null {
  const parts = [metadata.country, metadata.locationArea, metadata.city].filter(
    (part): part is string => typeof part === "string" && hasVisibleFieldValue(part),
  );
  return parts.length > 0 ? parts.join(" | ") : null;
}

function primaryInfoHeadline(item: DesktopViewerItem, metadata: DesktopMediaItemMetadata): string {
  if (hasVisibleFieldValue(item.title)) {
    return typeof item.title === "string" ? item.title.trim() : String(item.title);
  }
  return metadata.filename ?? item.title;
}

function buildInfoSections(metadata: DesktopMediaItemMetadata): {
  fileDataFields: DesktopInfoField[];
  captureDataFields: DesktopInfoField[];
  aiAnalysisFields: DesktopInfoField[];
  aiQualityFields: DesktopInfoField[];
  invoiceReceiptDataFields: DesktopInfoField[];
  invoiceReceiptHasSignal: boolean;
  videoDataFields: DesktopInfoField[];
} {
  const normalized = normalizeMetadata(metadata.aiMetadata ?? null);
  const ai = normalized.ai;
  const people = normalized.people;
  const extras = getAdditionalTopLevelFields(metadata.aiMetadata ?? null);
  const starRating =
    typeof extras.photo_star_rating_1_5 === "number"
      ? extras.photo_star_rating_1_5
      : null;
  const isLowQuality =
    typeof extras.is_low_quality === "boolean" ? extras.is_low_quality : null;
  const qualityIssues = Array.isArray(extras.quality_issues)
    ? extras.quality_issues.filter((issue): issue is string => typeof issue === "string")
    : [];
  const editSuggestions: Array<{ edit_type?: string; priority?: string; reason?: string }> = Array.isArray(
    extras.edit_suggestions,
  )
    ? extras.edit_suggestions.filter(
        (entry): entry is { edit_type?: string; priority?: string; reason?: string } =>
          typeof entry === "object" && entry !== null,
      )
    : [];
  const editSuggestionsCount = editSuggestions.length;
  const editSuggestionsText =
    editSuggestionsCount > 0
      ? editSuggestions
          .map((entry, index) => {
            const type = typeof entry.edit_type === "string" ? toHeadlineLabel(entry.edit_type) : null;
            const priority =
              typeof entry.priority === "string" ? toHeadlineLabel(entry.priority) : null;
            const reason = typeof entry.reason === "string" ? entry.reason.trim() : null;
            const suffix = [type, priority ? `Priority: ${priority}` : null]
              .filter(Boolean)
              .join(" | ");
            if (reason && suffix) {
              return `${index + 1}. ${suffix}\n${reason}`;
            }
            if (reason) {
              return `${index + 1}. ${reason}`;
            }
            if (suffix) {
              return `${index + 1}. ${suffix}`;
            }
            return `${index + 1}. Suggestion`;
          })
          .join("\n\n")
      : null;
  const documentData =
    normalized.document_data && typeof normalized.document_data === "object"
      ? normalized.document_data
      : null;

  const fileDataFields: DesktopInfoField[] = [
    { label: "Filename", value: metadata.filename },
    { label: "Path", value: metadata.sourcePath, display: "stacked" },
    { label: "MIME", value: metadata.mimeType },
    {
      label: "Dimensions",
      value:
        typeof metadata.width === "number" && typeof metadata.height === "number"
          ? `${metadata.width} x ${metadata.height} px`
          : null,
    },
    {
      label: "File size",
      value:
        typeof metadata.byteSize === "number"
          ? `${metadata.byteSize.toLocaleString()} bytes`
          : null,
    },
    { label: "Orientation", value: metadata.orientation },
    { label: "File date", value: metadata.fileCreatedAt },
    {
      label: "GPS",
      value:
        typeof metadata.latitude === "number" && typeof metadata.longitude === "number"
          ? `${metadata.latitude.toFixed(6)}, ${metadata.longitude.toFixed(6)}`
          : null,
    },
    {
      label: "Copies",
      value: metadata.sourceCount > 1 ? `${metadata.sourceCount} sources` : null,
    },
  ];

  const captureDataFields: DesktopInfoField[] = [
    {
      label: "Date taken",
      value: formatPhotoTakenListLabel(
        metadata.photoTakenAt,
        null,
        metadata.photoTakenPrecision,
      ),
    },
    { label: "Date precision", value: metadata.photoTakenPrecision },
    { label: "Embedded title", value: metadata.embeddedTitle, display: "stacked" },
    { label: "Embedded description", value: metadata.embeddedDescription, display: "stacked" },
    { label: "Embedded location", value: metadata.embeddedLocation, display: "stacked" },
    { label: "Camera make", value: metadata.cameraMake },
    { label: "Camera model", value: metadata.cameraModel },
    { label: "Lens model", value: metadata.lensModel },
    {
      label: "Focal length",
      value:
        typeof metadata.focalLengthMm === "number"
          ? `${metadata.focalLengthMm.toFixed(2)} mm`
          : null,
    },
    {
      label: "Aperture (f-number)",
      value: typeof metadata.fNumber === "number" ? `f/${metadata.fNumber.toFixed(1)}` : null,
    },
    { label: "Exposure time", value: metadata.exposureTime },
    { label: "ISO", value: metadata.iso },
  ];

  const aiAnalysisFields: DesktopInfoField[] = [
    { label: "Category", value: ai?.image_category ? toHeadlineLabel(ai.image_category) : null },
    { label: "Title", value: ai?.title ?? null },
    { label: "Description", value: ai?.description ?? null, display: "stacked" },
    { label: "People detected", value: people?.number_of_people ?? null },
    {
      label: "Has child or children",
      value: typeof people?.has_children === "boolean" ? (people.has_children ? "Yes" : "No") : null,
    },
  ];

  const aiQualityFields: DesktopInfoField[] = [
    { label: "Aesthetic quality (1-10)", value: ai?.photo_estetic_quality ?? null },
    { label: "Star rating (1-5)", value: starRating },
    {
      label: "Low quality",
      value: typeof isLowQuality === "boolean" ? (isLowQuality ? "Yes" : "No") : null,
    },
    {
      label: "Quality issues",
      value:
        qualityIssues.length > 0
          ? qualityIssues.map((issue) => toHeadlineLabel(issue)).join(", ")
          : null,
    },
    {
      label: "Edit suggestions",
      value: editSuggestionsCount > 0 ? editSuggestionsCount : null,
    },
    {
      label: "Edit suggestion details",
      value: editSuggestionsText,
      display: "stacked",
    },
  ];
  const invoiceTotalAmount =
    typeof documentData?.invoice_total_amount === "number"
      ? documentData.invoice_total_amount
      : null;
  const invoiceCurrency =
    typeof documentData?.invoice_total_amount_currency === "string"
      ? documentData.invoice_total_amount_currency
      : null;
  const invoiceAmountText =
    invoiceTotalAmount !== null && invoiceCurrency
      ? `${invoiceTotalAmount} ${invoiceCurrency}`
      : invoiceTotalAmount;
  const vatPercentText =
    typeof documentData?.vat_percent === "number" ? `${documentData.vat_percent}%` : null;
  const invoiceReceiptDataFields: DesktopInfoField[] = [
    { label: "Invoice issuer", value: documentData?.invoice_issuer ?? null },
    { label: "Invoice number", value: documentData?.invoice_number ?? null },
    { label: "Invoice date", value: documentData?.invoice_date ?? null },
    { label: "Client number", value: documentData?.client_number ?? null },
    { label: "Invoice total amount", value: invoiceAmountText },
    {
      label: "Invoice total amount currency",
      value: documentData?.invoice_total_amount_currency ?? null,
    },
    { label: "VAT %", value: vatPercentText },
    { label: "VAT amount", value: documentData?.vat_amount ?? null },
  ];

  const videoDurationSecondsRaw = extras.video_duration_seconds ?? extras.duration_seconds;
  const videoDurationSeconds = typeof videoDurationSecondsRaw === "number"
    ? videoDurationSecondsRaw
    : null;
  const videoDataFields: DesktopInfoField[] = [
    {
      label: "Duration",
      value: typeof videoDurationSeconds === "number" ? `${videoDurationSeconds.toFixed(1)} sec` : null,
    },
    { label: "FPS", value: typeof extras.video_fps === "number" ? extras.video_fps : null },
    {
      label: "Codec",
      value: typeof extras.video_codec === "string" ? extras.video_codec : null,
    },
    {
      label: "Container",
      value: typeof extras.video_container === "string" ? extras.video_container : null,
    },
  ];

  return {
    fileDataFields,
    captureDataFields,
    aiAnalysisFields,
    aiQualityFields,
    invoiceReceiptDataFields,
    invoiceReceiptHasSignal: invoiceReceiptDataFields.some((field) =>
      hasVisibleFieldValue(field.value),
    ),
    videoDataFields,
  };
}

/** Same shape as `DesktopFaceTagsTabContent` fallback when DB has faces but `ai_metadata` has no boxes. */
function synthesizedBoundingBoxesFromFaceInstances(instances: DesktopFaceInstance[]): BeingBoundingBox[] {
  return instances.map((inst) => ({
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
    provider_raw_bounding_box: null,
    azureFaceAttributes: null,
  }));
}

export function DesktopViewerInfoPanel({
  item,
  metadata,
  peopleBoundingBoxes,
  onRefreshMetadata,
}: DesktopViewerInfoPanelProps): ReactElement {
  const isVideo = item.mediaType === "video";
  const viewerActiveInfoTab = useDesktopStore((s) => s.viewerActiveInfoTab);
  const [activeTabId, setActiveTabId] = useState("info");
  const [selectedFaceIndex, setSelectedFaceIndex] = useState<number | null>(null);
  const [currentBoundingBoxes, setCurrentBoundingBoxes] = useState<BeingBoundingBox[]>(peopleBoundingBoxes);
  const imageRef = useRef<HTMLImageElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [imageInfo, setImageInfo] = useState<FaceOverlayImageInfo | null>(null);

  const updateImageInfo = useCallback(() => {
    if (!imageRef.current || !imageContainerRef.current) return;
    const img = imageRef.current;
    const container = imageContainerRef.current;
    const renderedWidth = img.clientWidth || img.offsetWidth;
    const renderedHeight = img.clientHeight || img.offsetHeight;
    const naturalWidth = img.naturalWidth || renderedWidth;
    const naturalHeight = img.naturalHeight || renderedHeight;
    const containerRect = container.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    setImageInfo({
      width: renderedWidth,
      height: renderedHeight,
      offsetX: imgRect.left - containerRect.left,
      offsetY: imgRect.top - containerRect.top,
      naturalWidth,
      naturalHeight,
    });
  }, []);

  useEffect(() => {
    setSelectedFaceIndex(null);
    setCurrentBoundingBoxes(peopleBoundingBoxes);
    /* Intentionally depend only on item.id: including peopleBoundingBoxes would re-run on every new [] reference and wipe boxes synthesized from face instances. */
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps -- peopleBoundingBoxes

  useEffect(() => {
    if (viewerActiveInfoTab) {
      setActiveTabId(viewerActiveInfoTab);
    }
  }, [viewerActiveInfoTab]);

  /** When `ai_metadata` has no people boxes but the catalog has face rows, keep synthesized boxes (see Face tags tab). */
  useEffect(() => {
    if (peopleBoundingBoxes.length === 0) return;
    setCurrentBoundingBoxes(peopleBoundingBoxes);
  }, [peopleBoundingBoxes]);

  useEffect(() => {
    if (isVideo) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const refreshed = await onRefreshMetadata(item.sourcePath);
      if (cancelled) return;
      let boxes = getPeopleBoundingBoxes(refreshed?.aiMetadata ?? null);
      if (boxes.length === 0) {
        const mediaId = item.mediaItemId ?? refreshed?.id ?? null;
        if (mediaId) {
          try {
            const instances = await window.desktopApi.listFaceInstancesForMediaItem(mediaId);
            if (!cancelled && instances.length > 0) {
              boxes = synthesizedBoundingBoxesFromFaceInstances(instances);
            }
          } catch {
            /* ignore */
          }
        }
      }
      if (!cancelled && boxes.length > 0) {
        setCurrentBoundingBoxes(boxes);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item.sourcePath, item.id, item.mediaItemId, onRefreshMetadata, isVideo]);

  useEffect(() => {
    if (isVideo) return;
    const img = imageRef.current;
    if (!img) return;
    if (img.complete) {
      updateImageInfo();
      return;
    }
    img.addEventListener("load", updateImageInfo);
    return () => img.removeEventListener("load", updateImageInfo);
  }, [updateImageInfo, item.id, isVideo]);

  useEffect(() => {
    if (isVideo) return;
    const observer = new ResizeObserver(() => updateImageInfo());
    if (imageRef.current) observer.observe(imageRef.current);
    if (imageContainerRef.current) observer.observe(imageContainerRef.current);
    window.addEventListener("resize", updateImageInfo);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateImageInfo);
    };
  }, [updateImageInfo, item.id, isVideo]);

  const infoSections = metadata ? buildInfoSections(metadata) : null;

  const { sortedBoxes: sortedFaceOverlayBoxes, displayToOriginal: faceDisplayOrder } = useMemo(
    () => getFaceTagsSortedBoxesAndOrder(currentBoundingBoxes),
    [currentBoundingBoxes],
  );

  return (
    <PhotoWithInfoPanel
      imageUrl={item.storage_url}
      imageAlt={item.title}
      activeTabId={activeTabId}
      onTabChange={(tabId) => {
        setActiveTabId(tabId);
        if (tabId !== "tags") setSelectedFaceIndex(null);
      }}
      renderPhotoPane={() => (
        <div
          ref={imageContainerRef}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {isVideo ? (
            <video
              src={item.storage_url}
              controls
              preload="metadata"
              playsInline
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            />
          ) : (
            <img
              ref={imageRef}
              src={item.storage_url}
              alt={item.title}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              onLoad={updateImageInfo}
            />
          )}
          {!isVideo && activeTabId === "tags" && imageInfo && sortedFaceOverlayBoxes.length > 0 ? (
            <FaceBoundingBoxOverlay
              boundingBoxes={sortedFaceOverlayBoxes}
              imageInfo={imageInfo}
              selectedIndex={selectedFaceIndex}
              onBoxClick={(index) => setSelectedFaceIndex(index)}
              originalWidth={metadata?.width ?? null}
              originalHeight={metadata?.height ?? null}
              getPersonLabel={(box) =>
                `${getCategoryLabel(box.person_category) ?? "Person"}${
                  box.gender ? ` (${getGenderLabel(box.gender)})` : ""
                }`
              }
            />
          ) : null}
        </div>
      )}
      tabs={[
        {
          id: "info",
          label: "Info",
          content: metadata ? (
            <div className="grid gap-3">
              <DesktopViewerInfoRatingRow sourcePath={item.sourcePath} starRating={metadata.starRating} />
              <h3 className="mb-1 text-lg text-foreground">{primaryInfoHeadline(item, metadata)}</h3>
              {(() => {
                const locLine = formatCatalogLocationLine(metadata);
                if (!locLine) return null;
                return (
                  <p className="m-0 text-sm text-muted-foreground">
                    <span className="text-foreground">Location:</span> {locLine}
                  </p>
                );
              })()}
              <DesktopInfoSection
                title={isVideo ? "Media file data" : "Image file data"}
                fields={infoSections?.fileDataFields ?? []}
                emptyStateMessage="No file-level metadata available."
              />
              {isVideo ? (
                <DesktopInfoSection
                  title="Video data"
                  fields={infoSections?.videoDataFields ?? []}
                  emptyStateMessage="No video-specific metadata available."
                />
              ) : null}
              <DesktopInfoSection
                title={isVideo ? "Capture data" : "Image capture data"}
                fields={infoSections?.captureDataFields ?? []}
                emptyStateMessage="No EXIF capture data available."
              />
              <DesktopInfoSection
                title="AI image analysis"
                fields={infoSections?.aiAnalysisFields ?? []}
                emptyStateMessage="Run AI analysis to populate this section."
              />
              <DesktopInfoSection
                title="AI quality analysis and improvements"
                fields={infoSections?.aiQualityFields ?? []}
                emptyStateMessage="No AI quality metadata available."
              />
              {infoSections?.invoiceReceiptHasSignal ? (
                <DesktopInfoSection
                  title="Invoice / receipt data"
                  fields={infoSections.invoiceReceiptDataFields}
                  emptyStateMessage="No invoice or receipt data available."
                />
              ) : null}
            </div>
          ) : (
            <div className="grid gap-3">
              <h3 className="mb-3.5 text-lg text-foreground">{item.title}</h3>
              <p className="m-0 text-muted-foreground">Metadata is not available yet for this file.</p>
            </div>
          ),
        },
        {
          id: "tags",
          label: "Face tags",
          badgeCount: currentBoundingBoxes.length > 0 ? currentBoundingBoxes.length : undefined,
          content: (
            <div className="grid gap-3">
              {isVideo ? (
                <p className="m-0 text-sm text-muted-foreground">
                  Face tags are available for images only.
                </p>
              ) : (
                <DesktopFaceTagsTabContent
                  mediaItemId={item.mediaItemId ?? metadata?.id ?? null}
                  sourcePath={item.sourcePath}
                  imageWidth={metadata?.width ?? null}
                  imageHeight={metadata?.height ?? null}
                  boundingBoxes={currentBoundingBoxes}
                  faceDisplayOrder={faceDisplayOrder}
                  selectedIndex={selectedFaceIndex}
                  onSelectIndex={(index) =>
                    setSelectedFaceIndex((current) => (current === index ? null : index))
                  }
                  onBoundingBoxesReplace={(boxes) => {
                    setCurrentBoundingBoxes(boxes);
                    setSelectedFaceIndex((current) =>
                      current !== null && current >= boxes.length ? null : current,
                    );
                  }}
                  onRefreshMetadataBoxes={async () => {
                    const refreshed = await onRefreshMetadata(item.sourcePath);
                    const boxes = getPeopleBoundingBoxes(refreshed?.aiMetadata ?? null);
                    setCurrentBoundingBoxes(boxes);
                    return boxes;
                  }}
                />
              )}
            </div>
          ),
        },
        {
          id: "metadata",
          label: "Metadata",
          content: (
            <div className="grid gap-3">
              <h3 className="mb-3.5 text-lg text-foreground">Metadata</h3>
              {metadata ? (
                <pre className="m-0 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted p-2.5 text-xs text-foreground">
                  {JSON.stringify(metadata.aiMetadata ?? metadata, null, 2)}
                </pre>
              ) : (
                <p className="m-0 text-muted-foreground">No metadata available</p>
              )}
            </div>
          ),
        },
      ]}
    />
  );
}

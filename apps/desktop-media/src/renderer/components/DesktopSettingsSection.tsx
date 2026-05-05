import { useEffect, useId, useState, type ReactElement } from "react";
import { ChevronDown, Square, Star } from "lucide-react";
import {
  MediaItemStarRating,
  SettingsCheckboxField,
  SettingsNumberField,
  SettingsSectionCard,
  type SettingsOptionSurfaceVariant,
} from "@emk/media-viewer";
import {
  AUX_MODEL_OPTIONS,
  DEFAULT_AI_IMAGE_SEARCH_SETTINGS,
  DEFAULT_FACE_DETECTION_SETTINGS,
  DEFAULT_FOLDER_SCANNING_SETTINGS,
  DEFAULT_MEDIA_VIEWER_SETTINGS,
  DEFAULT_PATH_EXTRACTION_SETTINGS,
  DEFAULT_PHOTO_ANALYSIS_SETTINGS,
  DEFAULT_SMART_ALBUM_SETTINGS,
  DEFAULT_WRONG_IMAGE_ROTATION_DETECTION_SETTINGS,
  SMART_ALBUM_EXCLUDABLE_IMAGE_CATEGORY_OPTIONS,
  FACE_DETECTOR_MODEL_OPTIONS,
  type AiImageSearchSettings,
  type AiInferenceGpuOption,
  type AuxModelId,
  type AuxModelKind,
  type AuxModelOption,
  type FaceAgeGenderModelId,
  type FaceDetectionSettings,
  type FaceDetectorModelId,
  type FaceLandmarkModelId,
  type FolderScanningSettings,
  type ImageOrientationModelId,
  type DateDisplayFormat,
  type MediaViewerSettings,
  type PathExtractionSettings,
  type PhotoAnalysisSettings,
  type PhotoPendingFolderIconTint,
  type QuickScanMovedFileMatchMode,
  type SmartAlbumRatingOperator,
  type SmartAlbumSettings,
  type WrongImageRotationDetectionSettings,
} from "../../shared/ipc";
import { cn } from "../lib/cn";
import { PipelineConcurrencySettings } from "./PipelineConcurrencySettings";
import { photoPendingTintToSquareClass } from "../lib/photo-pending-folder-tint";
import {
  INVOICE_DATA_EXTRACTION_PROMPT,
  INVOICE_DATA_EXTRACTION_PROMPT_VERSION,
  PHOTO_ANALYSIS_PROMPT,
  PHOTO_ANALYSIS_PROMPT_VERSION,
} from "../../shared/photo-analysis-prompt";

interface DesktopSettingsSectionProps {
  faceDetectionSettings: FaceDetectionSettings;
  wrongImageRotationDetectionSettings: WrongImageRotationDetectionSettings;
  photoAnalysisSettings: PhotoAnalysisSettings;
  folderScanningSettings: FolderScanningSettings;
  smartAlbumSettings: SmartAlbumSettings;
  aiImageSearchSettings: AiImageSearchSettings;
  hideAdvancedSettings: boolean;
  mediaViewerSettings: MediaViewerSettings;
  onFaceDetectionSettingChange: <K extends keyof FaceDetectionSettings>(
    key: K,
    value: FaceDetectionSettings[K],
  ) => void;
  onResetFaceDetectionOnlySettings: () => void;
  onResetFaceRecognitionOnlySettings: () => void;
  onWrongImageRotationDetectionSettingChange: <
    K extends keyof WrongImageRotationDetectionSettings,
  >(
    key: K,
    value: WrongImageRotationDetectionSettings[K],
  ) => void;
  onPhotoAnalysisSettingChange: <K extends keyof PhotoAnalysisSettings>(
    key: K,
    value: PhotoAnalysisSettings[K],
  ) => void;
  onResetPhotoAnalysisSettings: () => void;
  onFolderScanningSettingChange: <K extends keyof FolderScanningSettings>(
    key: K,
    value: FolderScanningSettings[K],
  ) => void;
  onSmartAlbumSettingChange: <K extends keyof SmartAlbumSettings>(
    key: K,
    value: SmartAlbumSettings[K],
  ) => void;
  onResetSmartAlbumSettings: () => void;
  onResetFolderScanningSectionSettings: () => void;
  onAiImageSearchSettingChange: <K extends keyof AiImageSearchSettings>(
    key: K,
    value: AiImageSearchSettings[K],
  ) => void;
  onResetAiImageSearchSettings: () => void;
  onHideAdvancedSettingsChange: (hide: boolean) => void;
  onMediaViewerSettingChange: <K extends keyof MediaViewerSettings>(
    key: K,
    value: MediaViewerSettings[K],
  ) => void;
  onResetMediaViewerSettings: () => void;
  pathExtractionSettings: PathExtractionSettings;
  onPathExtractionSettingChange: <K extends keyof PathExtractionSettings>(
    key: K,
    value: PathExtractionSettings[K],
  ) => void;
  aiInferencePreferredGpuId: string | null;
  aiInferenceGpuOptions: AiInferenceGpuOption[];
  onAiInferencePreferredGpuIdChange: (gpuId: string | null) => void;
}

const UI_TEXT = {
  title: "Settings",
  hideAdvancedSettingsTitle: "Hide advanced settings",
  scanForFileChanges: "Scan for file changes",
  /** Covers scan policy, embedded metadata writes, path helpers, and GPS reverse geocoding. */
  fileMetadataManagement: "Folder scanning, file metadata and Geo-location",
  albumsSectionTitle: "Albums",
  defaultAlbumFiltersTitle: "Default album filters",
  defaultAlbumFiltersHint: "You can change the values in album filters panel.",
  defaultRatingTitle: "Default Rating",
  defaultAiRatingTitle: "Default AI rating",
  excludedImageCategoriesTitle: "Exclude image categories in smart albums",
  emptyFolderAiSummaryTitle: "On empty folder selection show AI analysis status summary for subfolders",
  emptyFolderAiSummaryDescription: `When the folder you select has no images or videos in it directly but it contains sub-folders, open the Folder AI analysis summary in the main pane—the same view as “Folder AI analysis summary” on the folder’s right-click menu. It shows a table with face detection, AI image analysis, and AI search index status for this folder and all sub-folders (large trees may take a few seconds). If the folder has no sub-folders, this summary is not shown.`,
  pathExtractDatesTitle: "Extract date(s) from file path",
  pathExtractDatesDescription: `During a metadata scan, the app parses the file name and path. It looks for common patterns: YYYY-MM-DD; multi-day spans on one line; year-only or year-to-year ranges; YYYY-MM; eight-digit dates such as YYYYMMDD (including after camera-style prefixes like IMG_ or DSC_). If both an embedded capture date from the file and a path-derived date exist, the app compares calendar years: when the path-derived year is earlier than the embedded capture year, the event date from the path is used (typical when scans of old prints inherit a newer file date). Otherwise the embedded capture date wins. If neither exists, the file creation time may be used as a last resort. Results are stored in the database.`,
  pathUseLlmTitle: "Detect location and dates from file paths using AI (LLM)",
  pathUseLlmDescription: `When enabled, the folder’s right-click menu offers “Extract path metadata (LLM)”: the app sends folder and file path text to your local Ollama model to infer dates, places, and titles that simple rules cannot—useful for messy paths. Requires Ollama running with a compatible text model. The app picks an installed model by trying the Primary id first, then the Fallback id (see Ollama’s /api/tags).`,
  pathLlmModelPrimaryLabel: "Primary (Ollama model id)",
  pathLlmModelFallbackLabel: "Fallback (Ollama model id)",
  pathLlmModelDescription: `Use exact names from ollama list / ollama pull. If the Primary model is not installed locally, the app tries the Fallback, then other compatible Qwen-style tags.`,
  databaseLocation: "Application data files",
  databaseFolder: "Database folder",
  databaseFile: "Database file",
  modelsPath: "AI models folder",
  geonamesPath: "Geo-location database folder (GPS coordinates decoding to country, area, city)",
  cachePath: "Disposable cache folder",
  notAvailable: "Not available",
  faceDetection: "Face detection",
  faceRecognition: "Face recognition",
  photoAnalysis: "AI image analysis",
  wrongImageRotationDetection: "Wrong image rotation detection",
  aiImageSearch: "AI image search",
  aiImageSearchTranslationModelTitle: "AI model to translate search prompt to English",
  aiImageSearchTranslationModelDescription:
    "Use the exact Ollama model name from ollama list. The current built-in default is qwen2.5vl:3b.",
  mediaViewer: "Image / Video viewer",
  aiInferenceGpu: "Graphic card usage (GPU)",
  photoAnalysisPromptTitle: "Prompt used",
  invoicePromptTitle: "Invoice extraction prompt",
  photoAnalysisModelTitle: "AI model",
  photoAnalysisModelInstallNote: `The dropdown is not live-checked against Ollama in Settings. When you run Image AI analysis, the app sends images to Ollama using the model id you picked; if that model is not installed locally, Ollama fails the request. Labels such as “recommended default” name our built-in presets, not automatic detection of what is installed.`,
  photoAnalysisModelFutureNote: `Possible improvement: allow any Ollama vision model id (keeping our defaults as shortcuts), a “Test model” action that calls Ollama (for example /api/tags or a tiny request), and a clear reachable / missing result before a long batch.`,
  folderIconWhenPhotoPendingTitle: "Image analysis pending — folder icon",
  folderIconWhenPhotoPendingDescription: `Image analysis on a large library can take a long time. When face detection and AI search indexing are already complete for a folder but image analysis is not, choose how the folder icon is tinted so the sidebar does not show every folder as urgent red.`,
  folderIconWhenPhotoPendingRed: "Red (urgent)",
  folderIconWhenPhotoPendingAmber: "Amber (moderate)",
  folderIconWhenPhotoPendingGreen: "Green (same as fully complete)",
  photoAnalysisModelDescription: `Choose the vision model Ollama uses when you run Image AI analysis from folder menus. Larger models are often more accurate; smaller ones are faster and use less VRAM.`,
  photoAnalysisDownscaleTitle: "Downscale image dimensions before passing to LLM",
  /** Checkbox + longest-side input (single section). */
  photoAnalysisDownscaleCombinedDescription: `Very large photos can overwhelm the local AI service (Ollama) that analyzes images, or cause slow runs, failures, or connection errors. When this option is on, the app shrinks each photo so its longest side is at most the value you set below before sending it to the model. Lower values use less memory and are often faster; higher values keep more detail. That usually makes analysis more reliable and faster, with a small trade-off in fine detail. Turn the option off only when you truly need full resolution for a special case.`,
  photoAnalysisDownscaleLongestSideLabel: "Maximum length of the longest side (pixels)",
  detectWrongImageRotationBeforePipelinesTitle:
    "Analyze image rotation need before running other AI pipelines",
  detectWrongImageRotationBeforePipelinesDescription:
    "Runs wrong-rotation detection before AI search index, face detection, and AI image analysis. Already-processed images are skipped automatically.",
  faceLandmarkFallbackTitle:
    "Use face landmark features to detect photo rotation (fallback method)",
  faceLandmarkFallbackDescription:
    "Fallback only: if the primary image-orientation classifier is unavailable or inconclusive, use detected face landmarks (eyes/nose geometry) to infer rotation.",
  extractInvoiceDataTitle: "Extract invoice data",
  extractInvoiceDataDescription:
    "When an image is an invoice or receipt, run a second prompt to store issuer, invoice number/date, totals, currency, and VAT as structured fields.",
  gpsLocationDetectionTitle: "Detect Country / City from GPS coordinates",
  gpsLocationDetectionDescription:
    "During metadata scan, GPS coordinates are matched against offline GeoNames data to fill Country, State/Province, and City for search filters and folder views. First-time setup downloads about 2 GB of cached geographic data.",
  gpsLocationDetectionConfirmTitle: "Download location data?",
  gpsLocationDetectionConfirmMessage: "This will download approximately 2 GB of geographic data from GeoNames. The download happens in the background and data is cached locally for future use.",
  gpsLocationDetectionLocalCopyTitle: "Use local location data?",
  gpsLocationDetectionLocalCopyMessage: "GeoNames data is already present on this device. You can use the local copy now, or download it again if you want the latest GeoNames data.",
  gpsLocationDetectionConfirmOk: "Download",
  gpsLocationDetectionUseLocalCopy: "Use local copy",
  gpsLocationDetectionDownloadAgain: "Download again",
  gpsLocationDetectionConfirmCancel: "Cancel",
  /** Single label for all section reset buttons (one i18n key). */
  resetToDefaults: "Reset to defaults",
  autoPlayVideoOnSelectionTitle: "Automatically start playback on video selection",
  autoPlayVideoOnSelectionDescription:
    "Automatically starts video playback when a video is selected in the viewer (opening a video, using previous/next, or clicking a strip thumbnail).",
  skipVideosInSlideshowModeTitle: "Skip videos in album auto-playback mode",
  skipVideosInSlideshowModeDescription:
    "Skips videos during album playback mode if the album includes mix of images and videos.",
  dateFormatTitle: "Date format",
  dateFormatDescription: "How dates are shown throughout the app.",
};

/** ~1.2× smaller than the prior 26px settings checkbox; aligns with title row. */
const SETTINGS_OPTION_CHECKBOX_CLASS =
  "mt-1 h-[calc(26px/1.2)] w-[calc(26px/1.2)] shrink-0 cursor-pointer rounded-sm [accent-color:hsl(var(--primary))]";

const SETTINGS_CUSTOM_OPTION_SURFACE_CLASSES: Record<SettingsOptionSurfaceVariant, string> = {
  default: "rounded-md border border-border/70 border-l-4 border-l-border bg-background/40 p-3",
  "soft-selected": "rounded-md border border-border/70 border-l-4 border-l-border bg-background/40 p-3",
  "accent-stripe": "rounded-md border border-border/70 border-l-4 border-l-border bg-background/40 p-3",
  muted: "rounded-md border border-border/70 border-l-4 border-l-border bg-background/40 p-3",
};

function settingsCustomOptionSurfaceClass(variant: SettingsOptionSurfaceVariant): string {
  return SETTINGS_CUSTOM_OPTION_SURFACE_CLASSES[variant];
}

function SmartAlbumDefaultRatingSetting({
  title,
  value,
  operator,
  onOperatorChange,
  onChange,
}: {
  title: string;
  value: number | null;
  operator: SmartAlbumRatingOperator;
  onOperatorChange: (operator: SmartAlbumRatingOperator) => void;
  onChange: (value: number | null) => void;
}): ReactElement {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <h4 className="m-0 min-w-36 text-base font-medium text-foreground">{title}</h4>
        <button
          type="button"
          className="inline-flex h-8 min-w-11 items-center justify-center rounded-md border border-border bg-secondary px-2 text-sm font-semibold text-foreground hover:bg-muted"
          onClick={() => onOperatorChange(operator === "gte" ? "eq" : "gte")}
          aria-label={`${title} operator ${operator === "gte" ? "greater than or equal" : "equals"}`}
          title="Click to switch between ≥ and ="
        >
          {operator === "gte" ? "≥" : "="}
        </button>
        <MediaItemStarRating
          starRating={value}
          onChange={(next) => onChange(next > 0 ? next : null)}
          expanded
          tone="onCard"
        />
      </div>
    </div>
  );
}

export function DesktopSettingsSection({
  faceDetectionSettings,
  wrongImageRotationDetectionSettings,
  photoAnalysisSettings,
  folderScanningSettings,
  smartAlbumSettings,
  aiImageSearchSettings,
  hideAdvancedSettings,
  mediaViewerSettings,
  onFaceDetectionSettingChange,
  onResetFaceDetectionOnlySettings,
  onResetFaceRecognitionOnlySettings,
  onWrongImageRotationDetectionSettingChange,
  onPhotoAnalysisSettingChange,
  onResetPhotoAnalysisSettings,
  onFolderScanningSettingChange,
  onSmartAlbumSettingChange,
  onResetSmartAlbumSettings,
  onResetFolderScanningSectionSettings,
  onAiImageSearchSettingChange,
  onResetAiImageSearchSettings,
  onHideAdvancedSettingsChange,
  onMediaViewerSettingChange,
  onResetMediaViewerSettings,
  pathExtractionSettings,
  onPathExtractionSettingChange,
  aiInferencePreferredGpuId,
  aiInferenceGpuOptions,
  onAiInferencePreferredGpuIdChange,
}: DesktopSettingsSectionProps): ReactElement {
  const [showGpsConfirm, setShowGpsConfirm] = useState(false);
  const [gpsConfirmHasLocalCopy, setGpsConfirmHasLocalCopy] = useState(false);
  const [showWindowsGpuGuide, setShowWindowsGpuGuide] = useState(false);
  const [showAiModelHelp, setShowAiModelHelp] = useState(false);
  const [showPhotoDownscaleDescription, setShowPhotoDownscaleDescription] = useState(false);
  const [showAdvancedSearchDescription, setShowAdvancedSearchDescription] = useState(false);
  const [downscaleLongestSideDraft, setDownscaleLongestSideDraft] = useState(() =>
    String(photoAnalysisSettings.downscaleLongestSidePx),
  );
  const photoDownscaleCheckboxId = useId();
  const photoDownscaleLongestSideId = useId();
  const advancedSearchCheckboxId = useId();
  const showAdvancedSettings = !hideAdvancedSettings;

  useEffect(() => {
    setDownscaleLongestSideDraft(String(photoAnalysisSettings.downscaleLongestSidePx));
  }, [photoAnalysisSettings.downscaleLongestSidePx]);
  const [databaseLocation, setDatabaseLocation] = useState<{
    appDataPath: string;
    userDataPath: string;
    dbFileName: string;
    dbPath: string;
    modelsPath: string;
    geonamesPath: string;
    cachePath: string;
  } | null>(null);

  useEffect(() => {
    let disposed = false;
    void window.desktopApi
      .getDatabaseLocation()
      .then((next) => {
        if (!disposed) {
          setDatabaseLocation(next);
        }
      })
      .catch(() => {
        if (!disposed) {
          setDatabaseLocation(null);
        }
      });
    return () => {
      disposed = true;
    };
  }, []);

  const handleGpsToggle = (next: boolean): void => {
    if (next && !folderScanningSettings.detectLocationFromGps) {
      setGpsConfirmHasLocalCopy(false);
      setShowGpsConfirm(true);
      void window.desktopApi
        .getGeocoderCacheStatus()
        .then((status) => {
          setGpsConfirmHasLocalCopy(status.hasLocalCopy);
        })
        .catch(() => {
          setGpsConfirmHasLocalCopy(false);
        });
      return;
    }
    onFolderScanningSettingChange("detectLocationFromGps", next);
  };

  const enableGpsLocationDetection = (options?: { forceRefresh?: boolean }): void => {
    setShowGpsConfirm(false);
    onFolderScanningSettingChange("detectLocationFromGps", true);
    void window.desktopApi.initGeocoder(options);
  };

  const cancelGpsEnable = (): void => {
    setShowGpsConfirm(false);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-3 px-4 py-6 md:px-8">
      <h1 className="m-0 text-3xl font-bold text-foreground md:text-4xl">{UI_TEXT.title}</h1>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border/70 bg-card/40 px-3 py-2 text-sm text-foreground">
        <input
          type="checkbox"
          className="h-4 w-4 cursor-pointer [accent-color:hsl(var(--primary))]"
          checked={hideAdvancedSettings}
          onChange={(event) => onHideAdvancedSettingsChange(event.target.checked)}
        />
        <span>{UI_TEXT.hideAdvancedSettingsTitle}</span>
        <Star className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
      </label>

      <SettingsSectionCard title={UI_TEXT.mediaViewer}>
        <div className="space-y-3">
          <SettingsCheckboxField
            title={UI_TEXT.autoPlayVideoOnSelectionTitle}
            description={UI_TEXT.autoPlayVideoOnSelectionDescription}
            checked={mediaViewerSettings.autoPlayVideoOnOpen}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={(next) => onMediaViewerSettingChange("autoPlayVideoOnOpen", next)}
          />
          <SettingsCheckboxField
            title={UI_TEXT.skipVideosInSlideshowModeTitle}
            description={UI_TEXT.skipVideosInSlideshowModeDescription}
            checked={mediaViewerSettings.skipVideosInSlideshow}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={(next) => onMediaViewerSettingChange("skipVideosInSlideshow", next)}
          />
          <label
            className={cn(
              settingsCustomOptionSurfaceClass("accent-stripe"),
              "flex flex-col gap-2 border-l-primary/70 p-3",
            )}
          >
            <span className="text-sm font-medium text-foreground">{UI_TEXT.dateFormatTitle}</span>
            <p className="m-0 text-sm text-muted-foreground">{UI_TEXT.dateFormatDescription}</p>
            <select
              className="h-9 w-full max-w-sm rounded-md border border-border bg-background px-2 text-base"
              value={mediaViewerSettings.dateFormat}
              onChange={(event) =>
                onMediaViewerSettingChange("dateFormat", event.target.value as DateDisplayFormat)
              }
            >
              <option value="DD.MM.YYYY">DD.MM.YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            </select>
          </label>
          <div className="pt-1">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-md border border-border px-3 text-base"
              onClick={onResetMediaViewerSettings}
              disabled={
                mediaViewerSettings.autoPlayVideoOnOpen ===
                  DEFAULT_MEDIA_VIEWER_SETTINGS.autoPlayVideoOnOpen &&
                mediaViewerSettings.skipVideosInSlideshow ===
                  DEFAULT_MEDIA_VIEWER_SETTINGS.skipVideosInSlideshow &&
                mediaViewerSettings.dateFormat === DEFAULT_MEDIA_VIEWER_SETTINGS.dateFormat
              }
            >
              {UI_TEXT.resetToDefaults}
            </button>
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title={UI_TEXT.albumsSectionTitle}>
        <div className="space-y-3">
          <div className={cn(settingsCustomOptionSurfaceClass("muted"), "border-l-primary/70")}>
            <h4 className="m-0 text-base font-medium text-foreground">{UI_TEXT.defaultAlbumFiltersTitle}</h4>
            <p className="m-0 mt-1 text-sm text-muted-foreground">{UI_TEXT.defaultAlbumFiltersHint}</p>
            <div className="mt-3 space-y-3">
              <SmartAlbumDefaultRatingSetting
                title={UI_TEXT.defaultRatingTitle}
                value={smartAlbumSettings.defaultStarRating}
                operator={smartAlbumSettings.defaultStarRatingOperator}
                onOperatorChange={(next) =>
                  onSmartAlbumSettingChange("defaultStarRatingOperator", next)
                }
                onChange={(next) => onSmartAlbumSettingChange("defaultStarRating", next)}
              />
              <SmartAlbumDefaultRatingSetting
                title={UI_TEXT.defaultAiRatingTitle}
                value={smartAlbumSettings.defaultAiRating}
                operator={smartAlbumSettings.defaultAiRatingOperator}
                onOperatorChange={(next) =>
                  onSmartAlbumSettingChange("defaultAiRatingOperator", next)
                }
                onChange={(next) => onSmartAlbumSettingChange("defaultAiRating", next)}
              />
            </div>
          </div>
          <div className={cn(settingsCustomOptionSurfaceClass("muted"), "border-l-primary/70")}>
            <h4 className="m-0 text-base font-medium text-foreground">
              {UI_TEXT.excludedImageCategoriesTitle}
            </h4>
            <p className="m-0 mt-1 text-sm text-muted-foreground">
              Checked image categories are automatically added to smart album filters (i.e. excluded from shown
              results). These categories are identified during AI image analysis and are not available for images that
              have not yet been analyzed.
            </p>
            <div className="mt-3 space-y-2">
              {SMART_ALBUM_EXCLUDABLE_IMAGE_CATEGORY_OPTIONS.map(({ pattern, label }) => (
                <label
                  key={pattern}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    className={SETTINGS_OPTION_CHECKBOX_CLASS}
                    checked={smartAlbumSettings.excludedImageCategories.includes(pattern)}
                    onChange={(event) => {
                      const selected = new Set(smartAlbumSettings.excludedImageCategories);
                      if (event.target.checked) {
                        selected.add(pattern);
                      } else {
                        selected.delete(pattern);
                      }
                      const ordered = SMART_ALBUM_EXCLUDABLE_IMAGE_CATEGORY_OPTIONS.map((o) => o.pattern).filter((p) =>
                        selected.has(p),
                      );
                      onSmartAlbumSettingChange("excludedImageCategories", ordered);
                    }}
                  />
                  <span className="min-w-0 flex-1 text-sm leading-snug text-foreground">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="pt-1">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-md border border-border px-3 text-base"
              onClick={onResetSmartAlbumSettings}
              disabled={
                smartAlbumSettings.defaultStarRating ===
                  DEFAULT_SMART_ALBUM_SETTINGS.defaultStarRating &&
                smartAlbumSettings.defaultStarRatingOperator ===
                  DEFAULT_SMART_ALBUM_SETTINGS.defaultStarRatingOperator &&
                smartAlbumSettings.defaultAiRating ===
                  DEFAULT_SMART_ALBUM_SETTINGS.defaultAiRating &&
                smartAlbumSettings.defaultAiRatingOperator ===
                  DEFAULT_SMART_ALBUM_SETTINGS.defaultAiRatingOperator &&
                smartAlbumSettings.excludedImageCategories.join("|") ===
                  DEFAULT_SMART_ALBUM_SETTINGS.excludedImageCategories.join("|")
              }
            >
              {UI_TEXT.resetToDefaults}
            </button>
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title={UI_TEXT.fileMetadataManagement}>
        <div className="space-y-3">
          <SettingsCheckboxField
            title={UI_TEXT.pathExtractDatesTitle}
            description={UI_TEXT.pathExtractDatesDescription}
            checked={pathExtractionSettings.extractDates}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            surfaceVariant="accent-stripe"
            onChange={(next) => onPathExtractionSettingChange("extractDates", next)}
          />
          <SettingsCheckboxField
            title={UI_TEXT.gpsLocationDetectionTitle}
            description={UI_TEXT.gpsLocationDetectionDescription}
            checked={folderScanningSettings.detectLocationFromGps}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            surfaceVariant="accent-stripe"
            onChange={handleGpsToggle}
          />
          {showGpsConfirm ? (
            <div className="rounded-md border border-amber-700/60 border-l-4 border-l-primary/70 bg-amber-950/40 p-3">
              <p className="m-0 text-sm font-medium text-amber-200">
                {gpsConfirmHasLocalCopy
                  ? UI_TEXT.gpsLocationDetectionLocalCopyTitle
                  : UI_TEXT.gpsLocationDetectionConfirmTitle}
              </p>
              <p className="m-0 mt-1 text-sm text-amber-200/80">
                {gpsConfirmHasLocalCopy
                  ? UI_TEXT.gpsLocationDetectionLocalCopyMessage
                  : UI_TEXT.gpsLocationDetectionConfirmMessage}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 items-center rounded-md bg-amber-700 px-3 text-sm text-white hover:bg-amber-600"
                  onClick={() => enableGpsLocationDetection({ forceRefresh: false })}
                  autoFocus={gpsConfirmHasLocalCopy}
                >
                  {gpsConfirmHasLocalCopy
                    ? UI_TEXT.gpsLocationDetectionUseLocalCopy
                    : UI_TEXT.gpsLocationDetectionConfirmOk}
                </button>
                {gpsConfirmHasLocalCopy ? (
                  <button
                    type="button"
                    className="inline-flex h-8 items-center rounded-md border border-amber-700/70 px-3 text-sm text-amber-100 hover:bg-amber-900/40"
                    onClick={() => enableGpsLocationDetection({ forceRefresh: true })}
                  >
                    {UI_TEXT.gpsLocationDetectionDownloadAgain}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm"
                  onClick={cancelGpsEnable}
                >
                  {UI_TEXT.gpsLocationDetectionConfirmCancel}
                </button>
              </div>
            </div>
          ) : null}
          {showAdvancedSettings ? (
            <SettingsCheckboxField
              title={UI_TEXT.pathUseLlmTitle}
              description={UI_TEXT.pathUseLlmDescription}
              checked={pathExtractionSettings.useLlm}
              checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
              advanced
              surfaceVariant="accent-stripe"
              onChange={(next) => onPathExtractionSettingChange("useLlm", next)}
            />
          ) : null}
          {showAdvancedSettings && pathExtractionSettings.useLlm ? (
            <div
              className={cn(
                settingsCustomOptionSurfaceClass("accent-stripe"),
                "border-l-primary/70",
              )}
            >
              <div className="flex flex-col gap-3">
                <p className="m-0 text-sm text-muted-foreground">{UI_TEXT.pathLlmModelDescription}</p>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">{UI_TEXT.pathLlmModelPrimaryLabel}</span>
                  <input
                    type="text"
                    value={pathExtractionSettings.llmModelPrimary}
                    onChange={(e) => onPathExtractionSettingChange("llmModelPrimary", e.target.value)}
                    className="h-9 w-full max-w-md rounded-md border border-border bg-background px-2 text-base"
                    autoComplete="off"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground">{UI_TEXT.pathLlmModelFallbackLabel}</span>
                  <input
                    type="text"
                    value={pathExtractionSettings.llmModelFallback}
                    onChange={(e) => onPathExtractionSettingChange("llmModelFallback", e.target.value)}
                    className="h-9 w-full max-w-md rounded-md border border-border bg-background px-2 text-base"
                    autoComplete="off"
                  />
                </label>
              </div>
            </div>
          ) : null}
          <SettingsCheckboxField
            title={UI_TEXT.emptyFolderAiSummaryTitle}
            description={UI_TEXT.emptyFolderAiSummaryDescription}
            checked={folderScanningSettings.showFolderAiSummaryWhenSelectingEmptyFolder}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            surfaceVariant="accent-stripe"
            onChange={(next) =>
              onFolderScanningSettingChange("showFolderAiSummaryWhenSelectingEmptyFolder", next)
            }
          />
          {showAdvancedSettings ? (
            <SettingsNumberField
              title="Automatically scan folder for changes on selection if number of files less than"
              description={`When you open a folder, the app can automatically scan the files in that folder (not sub-folders) to refresh the database and detect new or moved images. On large folders this scan may take more than 10 seconds. If the number of images here is greater than or equal to this value, the automatic scan is skipped (thumbnails still load). To refresh the database yourself, use “${UI_TEXT.scanForFileChanges}” on the folder—use “Include sub-folders” to scan the whole tree, or turn it off to scan only this folder’s files.`}
              value={folderScanningSettings.autoMetadataScanOnSelectMaxFiles}
              min={0}
              max={1_000_000}
              step={1}
              advanced
              surfaceVariant="accent-stripe"
              onChange={(nextValue) =>
                onFolderScanningSettingChange(
                  "autoMetadataScanOnSelectMaxFiles",
                  Math.round(nextValue),
                )
              }
            />
          ) : null}
          {showAdvancedSettings ? (
            <SettingsNumberField
              title="Mark folder scan as outdated after"
              description="In the Folder AI summary, highlight the folder scan card in amber when the oldest folder scan in the tree is older than this many days."
              value={folderScanningSettings.markFolderScanOutdatedAfterDays}
              min={1}
              max={365}
              step={1}
              advanced
              surfaceVariant="accent-stripe"
              onChange={(nextValue) =>
                onFolderScanningSettingChange(
                  "markFolderScanOutdatedAfterDays",
                  Math.max(1, Math.round(nextValue)),
                )
              }
            />
          ) : null}
          {showAdvancedSettings ? (
            <label
              className={cn(
                settingsCustomOptionSurfaceClass("accent-stripe"),
                "flex flex-col gap-2 border-l-primary/70 p-3",
              )}
            >
              <span className="text-sm font-medium text-foreground">Quick scan: detect moved files using</span>
              <select
                className="h-9 w-full max-w-lg rounded-md border border-border bg-background px-2 text-base"
                value={folderScanningSettings.quickScanMovedFileMatchMode}
                onChange={(e) =>
                  onFolderScanningSettingChange(
                    "quickScanMovedFileMatchMode",
                    e.target.value as QuickScanMovedFileMatchMode,
                  )
                }
              >
                <option value="name-size">Filename + byte size (default, fast)</option>
                <option value="content-hash">SHA-256 content hash (slower, fewer false positives)</option>
              </select>
              <p className="m-0 text-sm text-muted-foreground">
                Applies to the normal quick scan in Folder AI summary when pairing removed catalog paths with new
                files on disk as moves within the scanned tree.
              </p>
            </label>
          ) : null}
          <SettingsCheckboxField
            title="Update file metadata on change of Rating, Title, Description"
            description={`XMP and EXIF are standard metadata blocks inside many image and video files; other apps (Lightroom, Windows) read them for star ratings and titles. When this option is on, after your change is saved in the database the app runs ExifTool to mirror rating into the file. When off, edits stay in the database only—original files on disk are not modified (recommended).`}
            checked={folderScanningSettings.writeEmbeddedMetadataOnUserEdit}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            surfaceVariant="accent-stripe"
            onChange={(next) => onFolderScanningSettingChange("writeEmbeddedMetadataOnUserEdit", next)}
          />
          <div className="pt-1">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-md border border-border px-3 text-base"
              onClick={onResetFolderScanningSectionSettings}
              disabled={
                folderScanningSettings.showFolderAiSummaryWhenSelectingEmptyFolder ===
                  DEFAULT_FOLDER_SCANNING_SETTINGS.showFolderAiSummaryWhenSelectingEmptyFolder &&
                folderScanningSettings.autoMetadataScanOnSelectMaxFiles ===
                  DEFAULT_FOLDER_SCANNING_SETTINGS.autoMetadataScanOnSelectMaxFiles &&
                folderScanningSettings.writeEmbeddedMetadataOnUserEdit ===
                  DEFAULT_FOLDER_SCANNING_SETTINGS.writeEmbeddedMetadataOnUserEdit &&
                folderScanningSettings.detectLocationFromGps ===
                  DEFAULT_FOLDER_SCANNING_SETTINGS.detectLocationFromGps &&
                folderScanningSettings.markFolderScanOutdatedAfterDays ===
                  DEFAULT_FOLDER_SCANNING_SETTINGS.markFolderScanOutdatedAfterDays &&
                folderScanningSettings.quickScanMovedFileMatchMode ===
                  DEFAULT_FOLDER_SCANNING_SETTINGS.quickScanMovedFileMatchMode &&
                pathExtractionSettings.extractDates === DEFAULT_PATH_EXTRACTION_SETTINGS.extractDates &&
                pathExtractionSettings.useLlm === DEFAULT_PATH_EXTRACTION_SETTINGS.useLlm &&
                pathExtractionSettings.llmModelPrimary === DEFAULT_PATH_EXTRACTION_SETTINGS.llmModelPrimary &&
                pathExtractionSettings.llmModelFallback === DEFAULT_PATH_EXTRACTION_SETTINGS.llmModelFallback
              }
            >
              {UI_TEXT.resetToDefaults}
            </button>
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title={UI_TEXT.aiInferenceGpu}
        advanced
        className={hideAdvancedSettings ? "hidden" : undefined}
      >
        <div className="space-y-3">
          <div
            className={cn(
              settingsCustomOptionSurfaceClass("accent-stripe"),
              "border-l-primary/70",
            )}
          >
            <h4 className="m-0 text-base font-medium text-foreground">GPU usage for AI inference</h4>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Select GPU adapter.
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                className="h-9 min-w-[260px] rounded-md border border-border bg-background px-2 text-sm text-foreground"
                value={aiInferencePreferredGpuId ?? "auto"}
                onChange={(event) => {
                  const next = event.target.value;
                  onAiInferencePreferredGpuIdChange(next === "auto" ? null : next);
                }}
              >
                {(aiInferenceGpuOptions.length > 0
                  ? aiInferenceGpuOptions
                  : [{ id: "auto", label: "Automatic (runtime default)" } as const]
                ).map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="m-0 mt-2 text-xs text-muted-foreground">
              Important: see Windows configuration settings below.
            </p>
          </div>
          <div
            className={cn(
              settingsCustomOptionSurfaceClass("accent-stripe"),
              showWindowsGpuGuide && "border-l-primary/70",
            )}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left"
              aria-expanded={showWindowsGpuGuide}
              onClick={() => setShowWindowsGpuGuide((v) => !v)}
            >
              <ChevronDown
                size={18}
                className={cn(
                  "shrink-0 text-muted-foreground transition-transform",
                  showWindowsGpuGuide ? "rotate-180" : "rotate-0",
                )}
                aria-hidden="true"
              />
              <span className="text-base font-medium text-foreground">
                Windows settings to enforce GPU use
              </span>
            </button>
            {showWindowsGpuGuide ? (
              <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p className="m-0">
                  Windows may ignore the GPU selection above on some devices. If your computer has multiple GPUs
                  (for example NVIDIA + built-in Intel Graphics), applying the Windows Graphics setting below is
                  highly recommended.
                </p>
                <ol className="m-0 list-decimal space-y-1 pl-5">
                  <li>Open Windows Settings -{">"} System -{">"} Display -{">"} Graphics.</li>
                  <li>Add this app executable if it is not listed.</li>
                  <li>Open Options for the app and choose High performance.</li>
                  <li>Save and restart the app.</li>
                  <li>Run Face detection and check Task Manager (Processes tab) columns GPU and GPU engine.</li>
                </ol>
              </div>
            ) : null}
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title={UI_TEXT.wrongImageRotationDetection}
        advanced
        className={hideAdvancedSettings ? "hidden" : undefined}
      >
        <div className="space-y-3">
          <SettingsCheckboxField
            title={UI_TEXT.detectWrongImageRotationBeforePipelinesTitle}
            description={UI_TEXT.detectWrongImageRotationBeforePipelinesDescription}
            checked={wrongImageRotationDetectionSettings.enabled}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={(next) => onWrongImageRotationDetectionSettingChange("enabled", next)}
          />
          <SettingsCheckboxField
            title={UI_TEXT.faceLandmarkFallbackTitle}
            description={UI_TEXT.faceLandmarkFallbackDescription}
            checked={wrongImageRotationDetectionSettings.useFaceLandmarkFeaturesFallback}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={(next) =>
              onWrongImageRotationDetectionSettingChange("useFaceLandmarkFeaturesFallback", next)
            }
          />
          <div className="pt-1">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-md border border-border px-3 text-base"
              onClick={() => {
                onWrongImageRotationDetectionSettingChange(
                  "enabled",
                  DEFAULT_WRONG_IMAGE_ROTATION_DETECTION_SETTINGS.enabled,
                );
                onWrongImageRotationDetectionSettingChange(
                  "useFaceLandmarkFeaturesFallback",
                  DEFAULT_WRONG_IMAGE_ROTATION_DETECTION_SETTINGS.useFaceLandmarkFeaturesFallback,
                );
              }}
              disabled={
                wrongImageRotationDetectionSettings.enabled ===
                  DEFAULT_WRONG_IMAGE_ROTATION_DETECTION_SETTINGS.enabled &&
                wrongImageRotationDetectionSettings.useFaceLandmarkFeaturesFallback ===
                  DEFAULT_WRONG_IMAGE_ROTATION_DETECTION_SETTINGS.useFaceLandmarkFeaturesFallback
              }
            >
              {UI_TEXT.resetToDefaults}
            </button>
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title={UI_TEXT.aiImageSearch}>
        <div className="space-y-3">
          <p className="m-0 whitespace-pre-line text-sm text-muted-foreground md:text-base">
            The search uses two methods: (1) visual similarity to VLM [Visual Language Model] embeddings and (2)
            similarity to image title and description obtained earlier from AI image analysis. The two results are
            combined using RRF (Reciprocal Rank Fusion). The search prompt must be in English, but can be automatically
            translated.
          </p>
          <div
            className={cn(
              settingsCustomOptionSurfaceClass("accent-stripe"),
              "border-l-primary/70",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="m-0 text-base font-medium text-foreground">
                    {UI_TEXT.aiImageSearchTranslationModelTitle}
                  </h4>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {UI_TEXT.aiImageSearchTranslationModelDescription}
                </p>
              </div>
              <input
                type="text"
                className="h-10 min-w-[260px] rounded-md border border-border bg-background px-2 text-sm text-foreground"
                value={aiImageSearchSettings.searchPromptTranslationModel}
                onChange={(event) =>
                  onAiImageSearchSettingChange("searchPromptTranslationModel", event.target.value)
                }
                autoComplete="off"
              />
            </div>
          </div>
          {showAdvancedSettings ? (
            <>
              <SettingsNumberField
                title="VLM (visual) similarity threshold"
                description="Controls how strict visual-image matching is; raise it to hide weak visual matches or lower it when relevant images disappear."
                value={aiImageSearchSettings.hideResultsBelowVlmSimilarity}
                min={0}
                max={1}
                step={0.01}
                advanced
                onChange={(nextValue) =>
                  onAiImageSearchSettingChange("hideResultsBelowVlmSimilarity", nextValue)
                }
              />
              <SettingsNumberField
                title="AI description similarity threshold"
                description="Controls how strict title-and-description matching is; raise it to hide weak caption matches or lower it when caption wording is close but not exact."
                value={aiImageSearchSettings.hideResultsBelowDescriptionSimilarity}
                min={0}
                max={1}
                step={0.01}
                advanced
                onChange={(nextValue) =>
                  onAiImageSearchSettingChange("hideResultsBelowDescriptionSimilarity", nextValue)
                }
              />
              <div
                className={cn(
                  settingsCustomOptionSurfaceClass("accent-stripe"),
                  aiImageSearchSettings.keywordMatchReranking && "border-l-primary/70",
                )}
              >
                <div className="flex items-start gap-3">
                  <input
                    id={advancedSearchCheckboxId}
                    type="checkbox"
                    className={SETTINGS_OPTION_CHECKBOX_CLASS}
                    checked={aiImageSearchSettings.keywordMatchReranking}
                    onChange={(event) =>
                      onAiImageSearchSettingChange("keywordMatchReranking", event.target.checked)
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor={advancedSearchCheckboxId}
                        className="m-0 cursor-pointer text-base font-medium text-foreground"
                      >
                        Experimental - Advanced search
                      </label>
                      <Star className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      <button
                        type="button"
                        aria-label="Toggle description for Experimental - Advanced search"
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-sm text-muted-foreground"
                        onClick={() => setShowAdvancedSearchDescription((current) => !current)}
                      >
                        ?
                      </button>
                    </div>
                    {showAdvancedSearchDescription ? (
                      <div className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                        Uses the local LLM to extract important search concepts and can re-rank results that match more of those concepts.
                      </div>
                    ) : null}
                  </div>
                </div>
                {aiImageSearchSettings.keywordMatchReranking ? (
                  <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
                    <label className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm font-medium text-foreground">
                        Keyword match threshold - VLM
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        className="h-9 w-32 rounded-md border border-border bg-background px-2 text-base"
                        value={aiImageSearchSettings.keywordMatchThresholdVlm}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          if (Number.isFinite(next)) {
                            onAiImageSearchSettingChange("keywordMatchThresholdVlm", next);
                          }
                        }}
                      />
                    </label>
                    <p className="m-0 text-xs text-muted-foreground">
                      Minimum keyword-to-image-embedding cosine score for counting a visual keyword hit; set to 0 to ignore VLM keyword hits.
                    </p>
                    <label className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm font-medium text-foreground">
                        Keyword match threshold - AI Description
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        className="h-9 w-32 rounded-md border border-border bg-background px-2 text-base"
                        value={aiImageSearchSettings.keywordMatchThresholdDescription}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          if (Number.isFinite(next)) {
                            onAiImageSearchSettingChange(
                              "keywordMatchThresholdDescription",
                              next,
                            );
                          }
                        }}
                      />
                    </label>
                    <p className="m-0 text-xs text-muted-foreground">
                      Minimum keyword-to-caption-embedding cosine score for counting a description keyword hit; set to 0 to ignore description keyword hits.
                    </p>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
          <div className="pt-1">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-md border border-border px-3 text-base"
              onClick={onResetAiImageSearchSettings}
              disabled={
                aiImageSearchSettings.hideResultsBelowVlmSimilarity ===
                  DEFAULT_AI_IMAGE_SEARCH_SETTINGS.hideResultsBelowVlmSimilarity &&
                aiImageSearchSettings.hideResultsBelowDescriptionSimilarity ===
                  DEFAULT_AI_IMAGE_SEARCH_SETTINGS.hideResultsBelowDescriptionSimilarity &&
                aiImageSearchSettings.searchPromptTranslationModel ===
                  DEFAULT_AI_IMAGE_SEARCH_SETTINGS.searchPromptTranslationModel &&
                aiImageSearchSettings.keywordMatchReranking ===
                  DEFAULT_AI_IMAGE_SEARCH_SETTINGS.keywordMatchReranking &&
                aiImageSearchSettings.keywordMatchThresholdVlm ===
                  DEFAULT_AI_IMAGE_SEARCH_SETTINGS.keywordMatchThresholdVlm &&
                aiImageSearchSettings.keywordMatchThresholdDescription ===
                  DEFAULT_AI_IMAGE_SEARCH_SETTINGS.keywordMatchThresholdDescription
              }
            >
              {UI_TEXT.resetToDefaults}
            </button>
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title={UI_TEXT.faceDetection}
        advanced
        className={hideAdvancedSettings ? "hidden" : undefined}
      >
        <div className="space-y-3">
          <div
            className={cn(
              settingsCustomOptionSurfaceClass("accent-stripe"),
              "border-l-primary/70",
            )}
          >
            <h4 className="m-0 text-base font-medium text-foreground">
              Face detection model
            </h4>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              RetinaFace (MobileNetV2) is the stable default. YOLO variants are newer and often more accurate; larger variants are slower. The ONNX weights are downloaded on demand the first time a variant is selected (no data is sent to any cloud service).
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                className="h-9 min-w-[260px] rounded-md border border-border bg-background px-2 text-sm text-foreground"
                value={faceDetectionSettings.detectorModel}
                onChange={(event) => {
                  const nextId = event.target.value as FaceDetectorModelId;
                  onFaceDetectionSettingChange("detectorModel", nextId);
                  void window.desktopApi.ensureDetectorModel(nextId).catch(() => {
                    // Errors surface via the face-model-download-progress channel
                  });
                }}
              >
                {FACE_DETECTOR_MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} (~{option.approxSizeMb} MB)
                  </option>
                ))}
              </select>
              <p className="m-0 text-xs text-muted-foreground">
                {FACE_DETECTOR_MODEL_OPTIONS.find(
                  (o) => o.id === faceDetectionSettings.detectorModel,
                )?.description ?? ""}
              </p>
            </div>
          </div>
          <SettingsNumberField
            title="Minimum confidence threshold"
            description="Filters out detected faces below this confidence score, which reduces false positives from patterns that only look like faces."
            value={faceDetectionSettings.minConfidenceThreshold}
            min={0}
            max={1}
            step={0.01}
            onChange={(nextValue) =>
              onFaceDetectionSettingChange("minConfidenceThreshold", nextValue)
            }
          />
          <SettingsNumberField
            title="Minimum face box short-side ratio"
            description="Discards face boxes whose short side is too small compared with the image, because very small faces are usually unreliable for tagging and matching."
            value={faceDetectionSettings.minFaceBoxShortSideRatio}
            min={0}
            max={1}
            step={0.01}
            onChange={(nextValue) =>
              onFaceDetectionSettingChange("minFaceBoxShortSideRatio", nextValue)
            }
          />
          <SettingsNumberField
            title="Face box overlap merge ratio"
            description="Merges heavily overlapping face boxes so one real face is not counted twice; the best confidence and landmarks are kept."
            value={faceDetectionSettings.faceBoxOverlapMergeRatio}
            min={0}
            max={1}
            step={0.01}
            onChange={(nextValue) =>
              onFaceDetectionSettingChange("faceBoxOverlapMergeRatio", nextValue)
            }
          />

          <SettingsNumberField
            title="Main subject: min face size ratio vs. largest face"
            description='Classifies a face as a main subject only when its short side is at least this fraction of the largest face, helping filters like "images with two people" ignore small background faces.'
            value={faceDetectionSettings.mainSubjectMinSizeRatioToLargest}
            min={0}
            max={1}
            step={0.05}
            onChange={(nextValue) =>
              onFaceDetectionSettingChange(
                "mainSubjectMinSizeRatioToLargest",
                nextValue,
              )
            }
          />
          <SettingsNumberField
            title="Main subject: min area fraction of the image"
            description="Classifies a face as a main subject only if its box covers at least this fraction of the image, so crowd photos with only tiny faces do not get misleading main-subject counts."
            value={faceDetectionSettings.mainSubjectMinImageAreaRatio}
            min={0}
            max={1}
            step={0.005}
            onChange={(nextValue) =>
              onFaceDetectionSettingChange(
                "mainSubjectMinImageAreaRatio",
                nextValue,
              )
            }
          />
          <SettingsNumberField
            title="Preserve person tags on re-detection: min IoU"
            description="When re-running face detection, existing tagged faces are kept only if a new face box overlaps them by at least this IoU value; 0 replaces all auto-detected faces."
            value={faceDetectionSettings.preserveTaggedFacesMinIoU}
            min={0}
            max={1}
            step={0.05}
            onChange={(nextValue) =>
              onFaceDetectionSettingChange(
                "preserveTaggedFacesMinIoU",
                nextValue,
              )
            }
          />
          <SettingsCheckboxField
            title="Keep tagged faces even when the new detector misses them"
            description="Keeps previously tagged face boxes even if a newly selected detector no longer finds them, preventing named people from disappearing after a re-run."
            checked={faceDetectionSettings.keepUnmatchedTaggedFaces}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={(next) =>
              onFaceDetectionSettingChange("keepUnmatchedTaggedFaces", next)
            }
          />

          <AuxModelToggleRow
            title="Face landmark refinement"
            kind="landmarks"
            description="Adds precise eye, nose, and mouth landmarks on top of YOLO detections for better face alignment, similarity matching, and rotation estimation."
            enabled={faceDetectionSettings.faceLandmarkRefinement.enabled}
            modelId={faceDetectionSettings.faceLandmarkRefinement.model}
            onEnabledChange={(enabled) =>
              onFaceDetectionSettingChange("faceLandmarkRefinement", {
                ...faceDetectionSettings.faceLandmarkRefinement,
                enabled,
              })
            }
            onModelChange={(next) =>
              onFaceDetectionSettingChange("faceLandmarkRefinement", {
                ...faceDetectionSettings.faceLandmarkRefinement,
                model: next as FaceLandmarkModelId,
              })
            }
          />
          <AuxModelToggleRow
            title="Face age & gender estimation"
            kind="age-gender"
            description="Stores approximate age and gender estimates for each detected face using a lightweight local ONNX classifier."
            enabled={faceDetectionSettings.faceAgeGenderDetection.enabled}
            modelId={faceDetectionSettings.faceAgeGenderDetection.model}
            onEnabledChange={(enabled) =>
              onFaceDetectionSettingChange("faceAgeGenderDetection", {
                ...faceDetectionSettings.faceAgeGenderDetection,
                enabled,
              })
            }
            onModelChange={(next) =>
              onFaceDetectionSettingChange("faceAgeGenderDetection", {
                ...faceDetectionSettings.faceAgeGenderDetection,
                model: next as FaceAgeGenderModelId,
              })
            }
          />

          <div className="pt-1">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-md border border-border px-3 text-base"
              onClick={onResetFaceDetectionOnlySettings}
              disabled={
                faceDetectionSettings.detectorModel ===
                  DEFAULT_FACE_DETECTION_SETTINGS.detectorModel &&
                faceDetectionSettings.minConfidenceThreshold ===
                  DEFAULT_FACE_DETECTION_SETTINGS.minConfidenceThreshold &&
                faceDetectionSettings.minFaceBoxShortSideRatio ===
                  DEFAULT_FACE_DETECTION_SETTINGS.minFaceBoxShortSideRatio &&
                faceDetectionSettings.faceBoxOverlapMergeRatio ===
                  DEFAULT_FACE_DETECTION_SETTINGS.faceBoxOverlapMergeRatio &&
                faceDetectionSettings.mainSubjectMinSizeRatioToLargest ===
                  DEFAULT_FACE_DETECTION_SETTINGS.mainSubjectMinSizeRatioToLargest &&
                faceDetectionSettings.mainSubjectMinImageAreaRatio ===
                  DEFAULT_FACE_DETECTION_SETTINGS.mainSubjectMinImageAreaRatio &&
                faceDetectionSettings.preserveTaggedFacesMinIoU ===
                  DEFAULT_FACE_DETECTION_SETTINGS.preserveTaggedFacesMinIoU &&
                faceDetectionSettings.keepUnmatchedTaggedFaces ===
                  DEFAULT_FACE_DETECTION_SETTINGS.keepUnmatchedTaggedFaces &&
                faceDetectionSettings.imageOrientationDetection.model ===
                  DEFAULT_FACE_DETECTION_SETTINGS.imageOrientationDetection.model &&
                faceDetectionSettings.faceLandmarkRefinement.enabled ===
                  DEFAULT_FACE_DETECTION_SETTINGS.faceLandmarkRefinement.enabled &&
                faceDetectionSettings.faceLandmarkRefinement.model ===
                  DEFAULT_FACE_DETECTION_SETTINGS.faceLandmarkRefinement.model &&
                faceDetectionSettings.faceAgeGenderDetection.enabled ===
                  DEFAULT_FACE_DETECTION_SETTINGS.faceAgeGenderDetection.enabled &&
                faceDetectionSettings.faceAgeGenderDetection.model ===
                  DEFAULT_FACE_DETECTION_SETTINGS.faceAgeGenderDetection.model
              }
            >
              {UI_TEXT.resetToDefaults}
            </button>
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
        title={UI_TEXT.faceRecognition}
        advanced
        className={hideAdvancedSettings ? "hidden" : undefined}
      >
        <div className="space-y-3">
          <SettingsNumberField
            title="Similarity threshold for suggesting a person"
            description="Controls how similar an untagged face must be to a named person before the app suggests that person; lower values show more suggestions, higher values are stricter."
            value={faceDetectionSettings.faceRecognitionSimilarityThreshold}
            min={0}
            max={1}
            step={0.01}
            onChange={(nextValue) =>
              onFaceDetectionSettingChange("faceRecognitionSimilarityThreshold", nextValue)
            }
          />
          <SettingsNumberField
            title="How similar two faces must look to join the same group"
            description="Controls how alike two untagged faces must be to enter the same draft group; lower values create larger broader groups, higher values keep groups smaller and tighter."
            value={faceDetectionSettings.faceGroupPairwiseSimilarityThreshold}
            min={0}
            max={1}
            step={0.01}
            onChange={(nextValue) =>
              onFaceDetectionSettingChange("faceGroupPairwiseSimilarityThreshold", nextValue)
            }
          />
          <SettingsNumberField
            title="Minimum faces in a suggested group"
            description="Drops draft face groups smaller than this after “Find groups”, keeping one-off detections out of the grouped Untagged list."
            value={faceDetectionSettings.faceGroupMinSize}
            min={2}
            max={500}
            step={1}
            onChange={(nextValue) =>
              onFaceDetectionSettingChange(
                "faceGroupMinSize",
                Math.round(nextValue),
              )
            }
          />

          <div className="pt-1">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-md border border-border px-3 text-base"
              onClick={onResetFaceRecognitionOnlySettings}
              disabled={
                faceDetectionSettings.faceRecognitionSimilarityThreshold ===
                  DEFAULT_FACE_DETECTION_SETTINGS.faceRecognitionSimilarityThreshold &&
                faceDetectionSettings.faceGroupPairwiseSimilarityThreshold ===
                  DEFAULT_FACE_DETECTION_SETTINGS.faceGroupPairwiseSimilarityThreshold &&
                faceDetectionSettings.faceGroupMinSize ===
                  DEFAULT_FACE_DETECTION_SETTINGS.faceGroupMinSize
              }
            >
              {UI_TEXT.resetToDefaults}
            </button>
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title={UI_TEXT.photoAnalysis}>
        <div className="space-y-3">
          <div
            className={cn(
              settingsCustomOptionSurfaceClass("accent-stripe"),
              "border-l-primary/70",
            )}
          >
            <h4 className="m-0 text-base font-medium text-foreground">{UI_TEXT.folderIconWhenPhotoPendingTitle}</h4>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {UI_TEXT.folderIconWhenPhotoPendingDescription}
            </p>
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="radiogroup"
              aria-label={UI_TEXT.folderIconWhenPhotoPendingTitle}
            >
              {(
                [
                  ["red", UI_TEXT.folderIconWhenPhotoPendingRed],
                  ["amber", UI_TEXT.folderIconWhenPhotoPendingAmber],
                  ["green", UI_TEXT.folderIconWhenPhotoPendingGreen],
                ] as const
              ).map(([tint, label]) => (
                <button
                  key={tint}
                  type="button"
                  role="radio"
                  aria-checked={
                    (photoAnalysisSettings.folderIconWhenPhotoAnalysisPending ??
                      DEFAULT_PHOTO_ANALYSIS_SETTINGS.folderIconWhenPhotoAnalysisPending) === tint
                  }
                  aria-label={label}
                  title={label}
                  className={cn(
                    "inline-flex h-11 w-11 items-center justify-center rounded-md border-2 bg-background p-0 shadow-none transition-colors",
                    (photoAnalysisSettings.folderIconWhenPhotoAnalysisPending ??
                      DEFAULT_PHOTO_ANALYSIS_SETTINGS.folderIconWhenPhotoAnalysisPending) === tint
                      ? "border-primary"
                      : "border-border hover:border-muted-foreground/40",
                  )}
                  onClick={() =>
                    onPhotoAnalysisSettingChange(
                      "folderIconWhenPhotoAnalysisPending",
                      tint as PhotoPendingFolderIconTint,
                    )
                  }
                >
                  <Square
                    className={photoPendingTintToSquareClass(tint)}
                    size={22}
                    strokeWidth={2.1}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </div>
          {showAdvancedSettings ? (
          <div
            className={cn(
              settingsCustomOptionSurfaceClass("accent-stripe"),
              "border-l-primary/70",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="m-0 text-base font-medium text-foreground">{UI_TEXT.photoAnalysisModelTitle}</h4>
                  <Star className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <button
                    type="button"
                    aria-label={`Toggle description for ${UI_TEXT.photoAnalysisModelTitle}`}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-sm text-muted-foreground"
                    onClick={() => setShowAiModelHelp((v) => !v)}
                  >
                    ?
                  </button>
                </div>
                {showAiModelHelp ? (
                  <div className="mt-1 space-y-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                    <div>{UI_TEXT.photoAnalysisModelDescription}</div>
                    <div>{UI_TEXT.photoAnalysisModelInstallNote}</div>
                    <div>{UI_TEXT.photoAnalysisModelFutureNote}</div>
                  </div>
                ) : null}
              </div>
              <input
                type="text"
                className="h-10 min-w-[260px] rounded-md border border-border bg-background px-2 text-sm text-foreground"
                value={photoAnalysisSettings.model}
                onChange={(event) => onPhotoAnalysisSettingChange("model", event.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          ) : null}
          {showAdvancedSettings ? (
          <SettingsNumberField
            title="Analysis timed out per image (seconds)"
            description="Marks a single image as failed if the local AI model spends longer than this many seconds analyzing it."
            value={photoAnalysisSettings.analysisTimeoutPerImageSec}
            min={10}
            max={1800}
            step={1}
            advanced
            onChange={(nextValue) =>
              onPhotoAnalysisSettingChange(
                "analysisTimeoutPerImageSec",
                Math.round(nextValue),
              )
            }
          />
          ) : null}
          {showAdvancedSettings ? (
          <div
            className={cn(
              settingsCustomOptionSurfaceClass("accent-stripe"),
              photoAnalysisSettings.downscaleBeforeLlm && "border-l-primary/70",
            )}
          >
            <div className="flex items-start gap-3">
              <input
                id={photoDownscaleCheckboxId}
                type="checkbox"
                className={SETTINGS_OPTION_CHECKBOX_CLASS}
                checked={photoAnalysisSettings.downscaleBeforeLlm}
                onChange={(event) =>
                  onPhotoAnalysisSettingChange("downscaleBeforeLlm", event.target.checked)
                }
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor={photoDownscaleCheckboxId}
                    className="m-0 cursor-pointer text-base font-medium text-foreground"
                  >
                    {UI_TEXT.photoAnalysisDownscaleTitle}
                  </label>
                  <Star className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <button
                    type="button"
                    aria-label={`Toggle description for ${UI_TEXT.photoAnalysisDownscaleTitle}`}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-sm text-muted-foreground"
                    onClick={() => setShowPhotoDownscaleDescription((current) => !current)}
                  >
                    ?
                  </button>
                </div>
                {showPhotoDownscaleDescription ? (
                  <div className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                    {UI_TEXT.photoAnalysisDownscaleCombinedDescription.trim()}
                  </div>
                ) : null}
              </div>
            </div>
            {photoAnalysisSettings.downscaleBeforeLlm ? (
              <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <label
                  htmlFor={photoDownscaleLongestSideId}
                  className="m-0 shrink-0 text-sm font-medium text-foreground"
                >
                  {UI_TEXT.photoAnalysisDownscaleLongestSideLabel}
                </label>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <input
                    id={photoDownscaleLongestSideId}
                    type="number"
                    min={256}
                    max={8192}
                    step={1}
                    className="h-9 w-32 rounded-md border border-border bg-background px-2 text-base text-foreground"
                    value={downscaleLongestSideDraft}
                    onChange={(event) => setDownscaleLongestSideDraft(event.target.value)}
                    onBlur={() => {
                      const parsed = Number(downscaleLongestSideDraft);
                      if (!Number.isFinite(parsed)) {
                        setDownscaleLongestSideDraft(String(photoAnalysisSettings.downscaleLongestSidePx));
                        return;
                      }
                      const clamped = Math.min(8192, Math.max(256, Math.round(parsed)));
                      onPhotoAnalysisSettingChange("downscaleLongestSidePx", clamped);
                      setDownscaleLongestSideDraft(String(clamped));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        (event.target as HTMLInputElement).blur();
                      }
                    }}
                  />
                  <span className="text-xs text-muted-foreground">Allowed range: 256 – 8192</span>
                </div>
              </div>
            ) : null}
          </div>
          ) : null}
          <SettingsCheckboxField
            title={UI_TEXT.extractInvoiceDataTitle}
            description={UI_TEXT.extractInvoiceDataDescription}
            checked={photoAnalysisSettings.extractInvoiceData}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={(next) =>
              onPhotoAnalysisSettingChange("extractInvoiceData", next)
            }
          />
          <div className="pt-1">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-md border border-border px-3 text-base"
              onClick={onResetPhotoAnalysisSettings}
              disabled={
                photoAnalysisSettings.model ===
                  DEFAULT_PHOTO_ANALYSIS_SETTINGS.model &&
                photoAnalysisSettings.analysisTimeoutPerImageSec ===
                  DEFAULT_PHOTO_ANALYSIS_SETTINGS.analysisTimeoutPerImageSec &&
                photoAnalysisSettings.downscaleBeforeLlm ===
                  DEFAULT_PHOTO_ANALYSIS_SETTINGS.downscaleBeforeLlm &&
                photoAnalysisSettings.downscaleLongestSidePx ===
                  DEFAULT_PHOTO_ANALYSIS_SETTINGS.downscaleLongestSidePx &&
                photoAnalysisSettings.extractInvoiceData ===
                  DEFAULT_PHOTO_ANALYSIS_SETTINGS.extractInvoiceData &&
                photoAnalysisSettings.folderIconWhenPhotoAnalysisPending ===
                  DEFAULT_PHOTO_ANALYSIS_SETTINGS.folderIconWhenPhotoAnalysisPending
              }
            >
              {UI_TEXT.resetToDefaults}
            </button>
          </div>
        </div>
        {showAdvancedSettings ? (
        <details className="mt-2.5 border-t border-border pt-2">
          <summary className="cursor-pointer select-none text-sm text-muted-foreground">
            {UI_TEXT.photoAnalysisPromptTitle} (version {PHOTO_ANALYSIS_PROMPT_VERSION}) - matches
            web-media JSON schema
          </summary>
          <pre className="mt-2 max-h-[180px] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted p-2 text-[13px] text-foreground">
            {PHOTO_ANALYSIS_PROMPT}
          </pre>
        </details>
        ) : null}
        {showAdvancedSettings ? (
        <details className="mt-2.5 border-t border-border pt-2">
          <summary className="cursor-pointer select-none text-sm text-muted-foreground">
            {UI_TEXT.invoicePromptTitle} (version {INVOICE_DATA_EXTRACTION_PROMPT_VERSION})
          </summary>
          <pre className="mt-2 max-h-[180px] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted p-2 text-[13px] text-foreground">
            {INVOICE_DATA_EXTRACTION_PROMPT}
          </pre>
        </details>
        ) : null}
      </SettingsSectionCard>

      <PipelineConcurrencySettings />

      <SettingsSectionCard
        title={UI_TEXT.databaseLocation}
        advanced
        className={hideAdvancedSettings ? "hidden" : undefined}
      >
        <div className="space-y-2">
          <div
            className={cn(
              settingsCustomOptionSurfaceClass("accent-stripe"),
              "border-l-primary/70",
            )}
          >
            <p className="m-0 text-sm text-muted-foreground">{UI_TEXT.databaseFolder}</p>
            <p className="mt-1 break-all font-mono text-sm text-foreground">
              {databaseLocation?.userDataPath ?? UI_TEXT.notAvailable}
            </p>
          </div>
          <div
            className={cn(
              settingsCustomOptionSurfaceClass("accent-stripe"),
              "border-l-primary/70",
            )}
          >
            <p className="m-0 text-sm text-muted-foreground">{UI_TEXT.databaseFile}</p>
            <p className="mt-1 break-all font-mono text-sm text-foreground">
              {databaseLocation?.dbPath ?? UI_TEXT.notAvailable}
            </p>
          </div>
          <div
            className={cn(
              settingsCustomOptionSurfaceClass("accent-stripe"),
              "border-l-primary/70",
            )}
          >
            <p className="m-0 text-sm text-muted-foreground">{UI_TEXT.modelsPath}</p>
            <p className="mt-1 break-all font-mono text-sm text-foreground">
              {databaseLocation?.modelsPath ?? UI_TEXT.notAvailable}
            </p>
          </div>
          <div
            className={cn(
              settingsCustomOptionSurfaceClass("accent-stripe"),
              "border-l-primary/70",
            )}
          >
            <p className="m-0 text-sm text-muted-foreground">{UI_TEXT.geonamesPath}</p>
            <p className="mt-1 break-all font-mono text-sm text-foreground">
              {databaseLocation?.geonamesPath ?? UI_TEXT.notAvailable}
            </p>
          </div>
          <div
            className={cn(
              settingsCustomOptionSurfaceClass("accent-stripe"),
              "border-l-primary/70",
            )}
          >
            <p className="m-0 text-sm text-muted-foreground">{UI_TEXT.cachePath}</p>
            <p className="mt-1 break-all font-mono text-sm text-foreground">
              {databaseLocation?.cachePath ?? UI_TEXT.notAvailable}
            </p>
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  );
}

interface AuxModelToggleRowProps {
  title: string;
  kind: AuxModelKind;
  description: string;
  enabled: boolean;
  modelId: AuxModelId;
  onEnabledChange: (next: boolean) => void;
  onModelChange: (next: AuxModelId) => void;
}

function auxModelCheckboxDescription(
  conceptual: string,
  option: AuxModelOption | undefined,
): string {
  const trimmed = conceptual.trim();
  if (!option) {
    return trimmed;
  }
  const modelLine =
    `Model: ${option.label} (~${option.approxSizeMb} MB). ${option.description} ${option.licenseNote}`.trim();
  return `${trimmed}\n\n${modelLine}`;
}

function AuxModelToggleRow({
  title,
  kind,
  description,
  enabled,
  modelId,
  onEnabledChange,
  onModelChange,
}: AuxModelToggleRowProps): ReactElement {
  const optionsForKind = AUX_MODEL_OPTIONS.filter(
    (option) => option.kind === kind,
  );
  const activeOption = optionsForKind.find((o) => o.id === modelId);

  return (
    <>
      <SettingsCheckboxField
        title={title}
        description={auxModelCheckboxDescription(description, activeOption)}
        checked={enabled}
        checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
        onChange={(next) => {
          onEnabledChange(next);
          if (next) {
            void window.desktopApi
              .ensureAuxModel(kind, modelId)
              .catch(() => {
                // Errors surface via the face-model-download-progress channel
              });
          }
        }}
      />
      {optionsForKind.length > 1 ? (
        <div
          className={cn(
            settingsCustomOptionSurfaceClass("accent-stripe"),
            enabled && "border-l-primary/70",
          )}
        >
          <select
            className="h-9 min-w-[260px] rounded-md border border-border bg-background px-2 text-sm text-foreground"
            value={modelId}
            disabled={!enabled}
            onChange={(event) => {
              const nextId = event.target.value as AuxModelId;
              onModelChange(nextId);
              if (enabled) {
                void window.desktopApi.ensureAuxModel(kind, nextId).catch(() => {
                  // Errors surface via the face-model-download-progress channel
                });
              }
            }}
          >
            {optionsForKind.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} (~{option.approxSizeMb} MB)
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </>
  );
}

import { useEffect, useId, useState, type ReactElement } from "react";
import { ChevronDown, Square } from "lucide-react";
import { SettingsCheckboxField, SettingsNumberField, SettingsSectionCard } from "@emk/media-viewer";
import {
  AUX_MODEL_OPTIONS,
  DEFAULT_AI_IMAGE_SEARCH_SETTINGS,
  DEFAULT_FACE_DETECTION_SETTINGS,
  DEFAULT_FOLDER_SCANNING_SETTINGS,
  DEFAULT_MEDIA_VIEWER_SETTINGS,
  DEFAULT_PATH_EXTRACTION_SETTINGS,
  DEFAULT_PHOTO_ANALYSIS_SETTINGS,
  DEFAULT_WRONG_IMAGE_ROTATION_DETECTION_SETTINGS,
  FACE_DETECTOR_MODEL_OPTIONS,
  type AiImageSearchSettings,
  type AiInferenceGpuOption,
  type AuxModelId,
  type AuxModelKind,
  type FaceAgeGenderModelId,
  type FaceDetectionSettings,
  type FaceDetectorModelId,
  type FaceLandmarkModelId,
  type FolderScanningSettings,
  type ImageOrientationModelId,
  type MediaViewerSettings,
  type PathExtractionSettings,
  type PhotoAnalysisSettings,
  type PhotoPendingFolderIconTint,
  type WrongImageRotationDetectionSettings,
} from "../../shared/ipc";
import { cn } from "../lib/cn";
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
  aiImageSearchSettings: AiImageSearchSettings;
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
  onResetFolderScanningSectionSettings: () => void;
  onAiImageSearchSettingChange: <K extends keyof AiImageSearchSettings>(
    key: K,
    value: AiImageSearchSettings[K],
  ) => void;
  onResetAiImageSearchSettings: () => void;
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
  scanForFileChanges: "Scan for file changes",
  /** Shorter than “folder change scanning and file metadata management”; covers scan policy + embedded writes + path helpers. */
  fileMetadataManagement: "Folder scanning & file metadata",
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
  cachePath: "Disposable cache folder",
  notAvailable: "Not available",
  faceDetection: "Face detection",
  faceRecognition: "Face recognition",
  photoAnalysis: "AI image analysis",
  wrongImageRotationDetection: "Wrong image rotation detection",
  aiImageSearch: "AI image search",
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
  extractInvoiceDataDescription: `Why: Structured fields are easier to search and reuse than text buried in a long description.

How: If image category is invoice_or_receipt, run a second prompt to extract issuer, invoice number/date, client number, totals, currency, and VAT fields into top-level metadata.document_data.`,
  gpsLocationDetectionTitle: "Detect Country / City from GPS coordinates",
  gpsLocationDetectionDescription: `Why: Images with GPS coordinates can be automatically tagged with Country, State/Province, and City for use in search filters, folder/album views, and smart albums.

How: During metadata scan, reverse-geocode GPS lat/lon using offline GeoNames data (cities with population >= 1000). First-time setup downloads ~2 GB of geographic data (cached locally).`,
  gpsLocationDetectionConfirmTitle: "Download location data?",
  gpsLocationDetectionConfirmMessage: "This will download approximately 2 GB of geographic data from GeoNames. The download happens in the background and data is cached locally for future use.",
  gpsLocationDetectionConfirmOk: "Download",
  gpsLocationDetectionConfirmCancel: "Cancel",
  /** Single label for all section reset buttons (one i18n key). */
  resetToDefaults: "Reset to defaults",
  autoPlayVideoOnSelectionTitle: "Automatically start playback on video selection",
  autoPlayVideoOnSelectionDescription:
    "Automatically starts video playback when a video is selected in the viewer (opening a video, using previous/next, or clicking a strip thumbnail).",
  skipVideosInSlideshowModeTitle: "Skip videos in album auto-playback mode",
  skipVideosInSlideshowModeDescription:
    "Skips videos during album playback mode if the album includes mix of images and videos.",
};

/** ~1.2× smaller than the prior 26px settings checkbox; aligns with title row. */
const SETTINGS_OPTION_CHECKBOX_CLASS =
  "mt-1 h-[calc(26px/1.2)] w-[calc(26px/1.2)] shrink-0 cursor-pointer rounded-sm [accent-color:hsl(var(--primary))]";

export function DesktopSettingsSection({
  faceDetectionSettings,
  wrongImageRotationDetectionSettings,
  photoAnalysisSettings,
  folderScanningSettings,
  aiImageSearchSettings,
  mediaViewerSettings,
  onFaceDetectionSettingChange,
  onResetFaceDetectionOnlySettings,
  onResetFaceRecognitionOnlySettings,
  onWrongImageRotationDetectionSettingChange,
  onPhotoAnalysisSettingChange,
  onResetPhotoAnalysisSettings,
  onFolderScanningSettingChange,
  onResetFolderScanningSectionSettings,
  onAiImageSearchSettingChange,
  onResetAiImageSearchSettings,
  onMediaViewerSettingChange,
  onResetMediaViewerSettings,
  pathExtractionSettings,
  onPathExtractionSettingChange,
  aiInferencePreferredGpuId,
  aiInferenceGpuOptions,
  onAiInferencePreferredGpuIdChange,
}: DesktopSettingsSectionProps): ReactElement {
  const [showGpsConfirm, setShowGpsConfirm] = useState(false);
  const [showWindowsGpuGuide, setShowWindowsGpuGuide] = useState(false);
  const [showAiModelHelp, setShowAiModelHelp] = useState(false);
  const [showPhotoDownscaleDescription, setShowPhotoDownscaleDescription] = useState(false);
  const [downscaleLongestSideDraft, setDownscaleLongestSideDraft] = useState(() =>
    String(photoAnalysisSettings.downscaleLongestSidePx),
  );
  const photoDownscaleCheckboxId = useId();
  const photoDownscaleLongestSideId = useId();

  useEffect(() => {
    setDownscaleLongestSideDraft(String(photoAnalysisSettings.downscaleLongestSidePx));
  }, [photoAnalysisSettings.downscaleLongestSidePx]);
  const [databaseLocation, setDatabaseLocation] = useState<{
    appDataPath: string;
    userDataPath: string;
    dbFileName: string;
    dbPath: string;
    modelsPath: string;
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
      setShowGpsConfirm(true);
      return;
    }
    onFolderScanningSettingChange("detectLocationFromGps", next);
  };

  const confirmGpsEnable = (): void => {
    setShowGpsConfirm(false);
    onFolderScanningSettingChange("detectLocationFromGps", true);
    void window.desktopApi.initGeocoder();
  };

  const cancelGpsEnable = (): void => {
    setShowGpsConfirm(false);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-3 px-4 py-6 md:px-8">
      <h1 className="m-0 text-3xl font-bold text-foreground md:text-4xl">{UI_TEXT.title}</h1>

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
          <div className="pt-1">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-md border border-border px-3 text-base"
              onClick={onResetMediaViewerSettings}
              disabled={
                mediaViewerSettings.autoPlayVideoOnOpen ===
                  DEFAULT_MEDIA_VIEWER_SETTINGS.autoPlayVideoOnOpen &&
                mediaViewerSettings.skipVideosInSlideshow ===
                  DEFAULT_MEDIA_VIEWER_SETTINGS.skipVideosInSlideshow
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
            title={UI_TEXT.emptyFolderAiSummaryTitle}
            description={UI_TEXT.emptyFolderAiSummaryDescription}
            checked={folderScanningSettings.showFolderAiSummaryWhenSelectingEmptyFolder}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={(next) =>
              onFolderScanningSettingChange("showFolderAiSummaryWhenSelectingEmptyFolder", next)
            }
          />
          <SettingsNumberField
            title="Automatically scan folder for changes on selection if number of files less than"
            description={`When you open a folder, the app can automatically scan the files in that folder (not sub-folders) to refresh the database and detect new or moved images. On large folders this scan may take more than 10 seconds. If the number of images here is greater than or equal to this value, the automatic scan is skipped (thumbnails still load). To refresh the database yourself, use “${UI_TEXT.scanForFileChanges}” on the folder—use “Include sub-folders” to scan the whole tree, or turn it off to scan only this folder’s files.`}
            value={folderScanningSettings.autoMetadataScanOnSelectMaxFiles}
            min={0}
            max={1_000_000}
            step={1}
            onChange={(nextValue) =>
              onFolderScanningSettingChange(
                "autoMetadataScanOnSelectMaxFiles",
                Math.round(nextValue),
              )
            }
          />
          <SettingsCheckboxField
            title="Update file metadata on change of Rating, Title, Description"
            description={`XMP and EXIF are standard metadata blocks inside many image and video files; other apps (Lightroom, Windows) read them for star ratings and titles. When this option is on, after your change is saved in the database the app runs ExifTool to mirror rating into the file. When off, edits stay in the database only—original files on disk are not modified (recommended).`}
            checked={folderScanningSettings.writeEmbeddedMetadataOnUserEdit}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={(next) => onFolderScanningSettingChange("writeEmbeddedMetadataOnUserEdit", next)}
          />
          <SettingsCheckboxField
            title={UI_TEXT.gpsLocationDetectionTitle}
            description={UI_TEXT.gpsLocationDetectionDescription}
            checked={folderScanningSettings.detectLocationFromGps}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={handleGpsToggle}
          />
          {showGpsConfirm ? (
            <div className="rounded-md border border-amber-700/60 bg-amber-950/40 p-3">
              <p className="m-0 text-sm font-medium text-amber-200">
                {UI_TEXT.gpsLocationDetectionConfirmTitle}
              </p>
              <p className="m-0 mt-1 text-sm text-amber-200/80">
                {UI_TEXT.gpsLocationDetectionConfirmMessage}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 items-center rounded-md bg-amber-700 px-3 text-sm text-white hover:bg-amber-600"
                  onClick={confirmGpsEnable}
                >
                  {UI_TEXT.gpsLocationDetectionConfirmOk}
                </button>
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
          <SettingsCheckboxField
            title={UI_TEXT.pathExtractDatesTitle}
            description={UI_TEXT.pathExtractDatesDescription}
            checked={pathExtractionSettings.extractDates}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={(next) => onPathExtractionSettingChange("extractDates", next)}
          />
          <SettingsCheckboxField
            title={UI_TEXT.pathUseLlmTitle}
            description={UI_TEXT.pathUseLlmDescription}
            checked={pathExtractionSettings.useLlm}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={(next) => onPathExtractionSettingChange("useLlm", next)}
          />
          {pathExtractionSettings.useLlm ? (
            <div className="rounded-md border border-border/70 bg-background/40 p-3">
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

      <SettingsSectionCard title={UI_TEXT.aiInferenceGpu}>
        <div className="space-y-3">
          <div className="rounded-md border border-border/70 bg-background/40 p-3">
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
          <div className="rounded-md border border-border/70 bg-background/40 p-3">
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

      <SettingsSectionCard title={UI_TEXT.wrongImageRotationDetection}>
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
          <SettingsNumberField
            title="VLM (visual) similarity threshold"
            description={`Why: Too low hides almost nothing; too high hides images that still look relevant.

How: Cosine similarity between the query and the image embedding. Typical visual matches sit lower than text-to-text scores; adjust if too many or too few images are hidden.`}
            value={aiImageSearchSettings.hideResultsBelowVlmSimilarity}
            min={0}
            max={1}
            step={0.01}
            onChange={(nextValue) =>
              onAiImageSearchSettingChange("hideResultsBelowVlmSimilarity", nextValue)
            }
          />
          <SettingsNumberField
            title="AI description similarity threshold"
            description={`Why: Captions can match your words even when the picture embedding does not.

How: Cosine similarity between the query and the embedding built from AI title + description. Works when the written caption matches, even if the scene embedding is weak.`}
            value={aiImageSearchSettings.hideResultsBelowDescriptionSimilarity}
            min={0}
            max={1}
            step={0.01}
            onChange={(nextValue) =>
              onAiImageSearchSettingChange("hideResultsBelowDescriptionSimilarity", nextValue)
            }
          />
          <SettingsCheckboxField
            title="Advanced search — Translate search prompt to English if needed"
            description={`Why: Non-English prompts hurt retrieval with the current text embedding pipeline.

How: With **Advanced search** enabled (in the search panel), the app asks the local model for structured analysis and uses the returned English query for embedding when available. This does not depend on keyword re-ranking below. Shown as always on (display only).`}
            checked={true}
            disabled
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={() => {}}
          />
          <SettingsCheckboxField
            title="Advanced search — Keyword match reranking"
            description={`Experimental: When enabled, the AI search results are obtained in two steps:
(1) Search prompt similarity comparison to visual [VLM] and/or text [AI description] embeddings
(2) Results re-ranking based on semantic match of the search prompt and key words extracted by LLM from the prompt
The re-ranking prioritizes showing first results that match all or most of keywords`}
            checked={aiImageSearchSettings.keywordMatchReranking}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={(next) => onAiImageSearchSettingChange("keywordMatchReranking", next)}
          />
          <SettingsNumberField
            title="Advanced search — Keyword match threshold - VLM"
            description={`Why: Visual keyword matches use a different similarity scale than text-to-text.

How: Used only when **Keyword match reranking** is on. Minimum cosine between each keyword embedding and the image’s VLM embedding for a hit. Range 0–1. At **0**, the VLM limb does not count toward keyword hits (the AI description limb may still apply in hybrid).`}
            value={aiImageSearchSettings.keywordMatchThresholdVlm}
            min={0}
            max={1}
            step={0.01}
            disabled={!aiImageSearchSettings.keywordMatchReranking}
            onChange={(nextValue) =>
              onAiImageSearchSettingChange("keywordMatchThresholdVlm", nextValue)
            }
          />
          <SettingsNumberField
            title="Advanced search — Keyword match threshold - AI Description"
            description={`Why: Caption-to-keyword similarity behaves differently from VLM.

How: Used only when **Keyword match reranking** is on. Minimum cosine between each keyword embedding and the AI title+description embedding for a hit. Range 0–1. At **0**, the description limb does not contribute. If **both** this and the VLM keyword threshold are **0**, keyword re-ranking is skipped (set at least one above 0).`}
            value={aiImageSearchSettings.keywordMatchThresholdDescription}
            min={0}
            max={1}
            step={0.01}
            disabled={!aiImageSearchSettings.keywordMatchReranking}
            onChange={(nextValue) =>
              onAiImageSearchSettingChange("keywordMatchThresholdDescription", nextValue)
            }
          />
          <SettingsCheckboxField
            title="Show matching method selector in search filters"
            description={`Why: The AI search uses a mix of visual similarity (VLM) and similarity to image description. This allows to control which of the two methods are used to compare results.

How: When enabled, the AI image search panel shows a "Matching method" control next to Advanced search (hybrid vs VLM only vs description only). When off, search always uses the default combined ranking and visibility rules.`}
            checked={aiImageSearchSettings.showMatchingMethodSelector}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={(next) => onAiImageSearchSettingChange("showMatchingMethodSelector", next)}
          />
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
                aiImageSearchSettings.showMatchingMethodSelector ===
                  DEFAULT_AI_IMAGE_SEARCH_SETTINGS.showMatchingMethodSelector &&
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

      <SettingsSectionCard title={UI_TEXT.faceDetection}>
        <div className="space-y-3">
          <div className="rounded-md border border-border/70 bg-background/40 p-3">
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
            description={`Why: Removes weak detections that are often false positives (patterns that look like faces).

How: Each detected face gets a confidence score from 0 to 1; any score below this value is filtered out before saving results.`}
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
            description={`Why: Ignores tiny face boxes that are usually too small for reliable tagging and matching.

How: The detector compares the face box short side to the image short side; if that ratio is below this threshold, the face is discarded.`}
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
            description={`Why: Prevents one real face from being counted twice when two boxes overlap heavily.

How: If overlap area is higher than this ratio (relative to either box), boxes are merged into one larger box and the best confidence/landmarks are kept.`}
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
            description={`Why: In group shots the main subjects are usually larger than background faces. Filters like "images with two people" can then include photos where only two are main subjects and others are in the background.

How: A face is classified as a "main subject" only if its short side is at least this fraction of the largest detected face's short side. Example: 0.5 means half as tall as the biggest face still counts as main; 1.0 means only the single largest face is main.`}
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
            description={`Why: A secondary safeguard: when all detected faces are tiny (e.g. a crowd photo), none of them should be called "main".

How: A face is classified as a main subject only if its bounding-box area is at least this fraction of the whole image area. 0.01 ≈ 1% of the image. Lower values make the rule more permissive.`}
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
            description={`Why: When you re-run face detection on an image that already has tagged faces, the app matches each newly-detected face to the existing tagged faces so the tag is kept.

How: Matching uses IoU (Intersection over Union). A pair matches only if IoU ≥ this value. 0 disables tag preservation (every run replaces all auto-detected faces).`}
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
            description={`Why: Models disagree. Switching to a less sensitive detector should not silently drop a face you already named.

How: When on, previously-tagged face boxes with no newly-detected match are kept in the database. When off, re-running face detection replaces all auto-detected faces (any tag on an unmatched box is lost).`}
            checked={faceDetectionSettings.keepUnmatchedTaggedFaces}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={(next) =>
              onFaceDetectionSettingChange("keepUnmatchedTaggedFaces", next)
            }
          />

          <AuxModelToggleRow
            title="Face landmark refinement"
            kind="landmarks"
            description={`Why: Adds precise 5-point facial landmarks (eyes, nose, mouth corners) on top of YOLO detections. Landmarks enable more accurate face alignment, similarity matching and rotation estimation from faces.

How: Runs a tiny PFLD-GhostOne model on each detected face crop and reduces its 98 landmarks to 5 canonical points.`}
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
            description={`Why: Populates estimated age and gender for each detected face to power search and filter features.

How: Runs a lightweight ONNX classifier on each detected face crop. Estimates are approximate and stored alongside the face record.`}
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

      <SettingsSectionCard title={UI_TEXT.faceRecognition}>
        <div className="space-y-3">
          <SettingsNumberField
            title="Similarity threshold for suggesting a person"
            description={`Why: Controls how close an untagged face must be to someone you already named before the app suggests that person (for example in “similar faces” hints).

How: Uses a similarity score from 0 to 1. Lower values show more suggestions (including more mistakes); higher values are stricter and may miss real matches.`}
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
            description={`Why: The app can bundle untagged faces into draft groups so you can name many at once. This controls how “alike” two faces must be to end up in the same draft group. Lower values create larger, broader groups (more mixing of different people); higher values keep groups smaller and tighter.

How: Uses a similarity score from 0 to 1 between two face signatures. Only used when you run grouping—not when detecting faces in a single photo.`}
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
            description={`Why: Very small groups are often noise or one-off detections; requiring a few faces together keeps the Untagged list easier to work through.

How: After you click “Find groups” under People → Untagged faces, any draft group with fewer than this many faces is dropped and those faces stay ungrouped until the next time you run Find groups.`}
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
          <div className="rounded-md border border-border/70 bg-background/40 p-3">
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
          <div className="rounded-md border border-border/70 bg-background/40 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="m-0 text-base font-medium text-foreground">{UI_TEXT.photoAnalysisModelTitle}</h4>
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
          <SettingsNumberField
            title="Analysis timed out per image (seconds)"
            description={`Why: Stops one stuck image from blocking the rest of a batch indefinitely.

How: If analysis of a single image exceeds this many seconds, it is marked failed (timeout).`}
            value={photoAnalysisSettings.analysisTimeoutPerImageSec}
            min={10}
            max={1800}
            step={1}
            onChange={(nextValue) =>
              onPhotoAnalysisSettingChange(
                "analysisTimeoutPerImageSec",
                Math.round(nextValue),
              )
            }
          />
          <div className="rounded-md border border-border/70 bg-background/40 p-3">
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
        <details className="mt-2.5 border-t border-border pt-2">
          <summary className="cursor-pointer select-none text-sm text-muted-foreground">
            {UI_TEXT.photoAnalysisPromptTitle} (version {PHOTO_ANALYSIS_PROMPT_VERSION}) - matches
            web-media JSON schema
          </summary>
          <pre className="mt-2 max-h-[180px] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted p-2 text-[13px] text-foreground">
            {PHOTO_ANALYSIS_PROMPT}
          </pre>
        </details>
        <details className="mt-2.5 border-t border-border pt-2">
          <summary className="cursor-pointer select-none text-sm text-muted-foreground">
            {UI_TEXT.invoicePromptTitle} (version {INVOICE_DATA_EXTRACTION_PROMPT_VERSION})
          </summary>
          <pre className="mt-2 max-h-[180px] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted p-2 text-[13px] text-foreground">
            {INVOICE_DATA_EXTRACTION_PROMPT}
          </pre>
        </details>
      </SettingsSectionCard>

      <SettingsSectionCard title={UI_TEXT.databaseLocation}>
        <div className="space-y-2">
          <div className="rounded-md border border-border/70 bg-background/40 p-3">
            <p className="m-0 text-sm text-muted-foreground">{UI_TEXT.databaseFolder}</p>
            <p className="mt-1 break-all font-mono text-sm text-foreground">
              {databaseLocation?.userDataPath ?? UI_TEXT.notAvailable}
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-background/40 p-3">
            <p className="m-0 text-sm text-muted-foreground">{UI_TEXT.databaseFile}</p>
            <p className="mt-1 break-all font-mono text-sm text-foreground">
              {databaseLocation?.dbPath ?? UI_TEXT.notAvailable}
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-background/40 p-3">
            <p className="m-0 text-sm text-muted-foreground">{UI_TEXT.modelsPath}</p>
            <p className="mt-1 break-all font-mono text-sm text-foreground">
              {databaseLocation?.modelsPath ?? UI_TEXT.notAvailable}
            </p>
          </div>
          <div className="rounded-md border border-border/70 bg-background/40 p-3">
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
    <div className="rounded-md border border-border/70 bg-background/40 p-3">
      <div className="flex flex-col gap-2">
        <SettingsCheckboxField
          title={title}
          description={description}
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
            {activeOption ? (
              <p className="m-0 text-xs text-muted-foreground">
                {activeOption.description} {activeOption.licenseNote}
              </p>
            ) : null}
          </div>
        ) : activeOption ? (
          <p className="m-0 text-xs text-muted-foreground">
            Model: <span className="font-medium">{activeOption.label}</span> (~
            {activeOption.approxSizeMb} MB). {activeOption.description}{" "}
            {activeOption.licenseNote}
          </p>
        ) : null}
      </div>
    </div>
  );
}

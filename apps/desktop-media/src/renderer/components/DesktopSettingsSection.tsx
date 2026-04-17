import { useEffect, useState, type ReactElement } from "react";
import { Square } from "lucide-react";
import { SettingsCheckboxField, SettingsNumberField, SettingsSectionCard } from "@emk/media-viewer";
import {
  DEFAULT_AI_IMAGE_SEARCH_SETTINGS,
  DEFAULT_FACE_DETECTION_SETTINGS,
  DEFAULT_FOLDER_SCANNING_SETTINGS,
  DEFAULT_MEDIA_VIEWER_SETTINGS,
  DEFAULT_PATH_EXTRACTION_SETTINGS,
  DEFAULT_PHOTO_ANALYSIS_SETTINGS,
  type AiImageSearchSettings,
  type FaceDetectionSettings,
  type FolderScanningSettings,
  type MediaViewerSettings,
  type PathExtractionSettings,
  type PhotoAnalysisSettings,
  type PhotoPendingFolderIconTint,
} from "../../shared/ipc";
import { cn } from "../lib/cn";
import { photoPendingTintToSquareClass } from "../lib/photo-pending-folder-tint";
import {
  INVOICE_DATA_EXTRACTION_PROMPT,
  INVOICE_DATA_EXTRACTION_PROMPT_VERSION,
  PHOTO_ANALYSIS_PROMPT,
  PHOTO_ANALYSIS_PROMPT_VERSION,
  VISION_MODEL_OPTIONS,
} from "../../shared/photo-analysis-prompt";

interface DesktopSettingsSectionProps {
  faceDetectionSettings: FaceDetectionSettings;
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
  onPhotoAnalysisSettingChange: <K extends keyof PhotoAnalysisSettings>(
    key: K,
    value: PhotoAnalysisSettings[K],
  ) => void;
  onResetPhotoAnalysisSettings: () => void;
  onFolderScanningSettingChange: <K extends keyof FolderScanningSettings>(
    key: K,
    value: FolderScanningSettings[K],
  ) => void;
  onResetFolderScanningSettings: () => void;
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
  onResetPathExtractionSettings: () => void;
}

const UI_TEXT = {
  title: "Settings",
  scanForFileChanges: "Scan for file changes",
  fileMetadataManagement: "File metadata management",
  pathFromFilenamesTitle: "Dates and places from file paths",
  pathExtractDatesTitle: "Fast extraction: infer event dates from paths",
  pathExtractDatesDescription: `Why: Folder and file names often encode years or trip segments.

How: During metadata scan, run lightweight rules (no network) to fill catalog event dates when EXIF is missing.`,
  pathExtractLocationTitle: "Fast extraction: infer location hints from paths",
  pathExtractLocationDescription: `Why: Some libraries encode country or city in folder names.

How: During metadata scan, map obvious tokens into catalog location fields when empty.`,
  pathUseLlmTitle: "LLM path analysis (folder menu)",
  pathUseLlmDescription: `Why: Complex paths need reasoning beyond regex.

How: When enabled, the folder context menu offers “Extract path metadata (LLM)” using your local Ollama text model. Requires Ollama running.`,
  pathLlmModelTitle: "LLM model name (Ollama)",
  pathLlmModelDescription: `Optional. Leave blank to auto-pick an installed Qwen model via Ollama’s /api/tags — same logic as Advanced AI search query understanding (prefers qwen2.5vl:3b, then qwen3.5:9b). Or set an exact id from ollama list if you want a specific model.`,
  databaseLocation: "Application data files",
  databaseFolder: "Database folder",
  databaseFile: "Database file",
  modelsPath: "AI models folder",
  cachePath: "Disposable cache folder",
  notAvailable: "Not available",
  faceDetection: "Face detection",
  faceRecognition: "Face recognition",
  photoAnalysis: "Image analysis",
  aiImageSearch: "AI image search",
  mediaViewer: "Image / Video viewer",
  folderScanWithoutSubfoldersNote: "Without sub-folders",
  photoAnalysisPromptTitle: "Prompt used",
  invoicePromptTitle: "Invoice extraction prompt",
  photoAnalysisModelTitle: "AI model",
  folderIconWhenPhotoPendingTitle: "Image analysis pending — folder icon",
  folderIconWhenPhotoPendingDescription: `Image analysis on a large library can take a long time. When face detection and AI search indexing are already complete for a folder but image analysis is not, choose how the folder icon is tinted so the sidebar does not show every folder as urgent red.`,
  folderIconWhenPhotoPendingRed: "Red (urgent)",
  folderIconWhenPhotoPendingAmber: "Amber (moderate)",
  folderIconWhenPhotoPendingGreen: "Green (same as fully complete)",
  photoAnalysisModelDescription: `Why: Different models balance speed, quality, and what your machine can run comfortably.

How: This is the vision model used when you start Image AI analysis from the folder menus.`,
  twoPassRotationTitle: "Two-pass analysis for rotated images",
  twoPassRotationDescription: `Why: One pass on the original image can miss or misread metadata when the photo still needs rotation.

How: If a photo needs 90/180/270 rotation, run a second analysis on the rotated preview to improve metadata reliability (for example crop suggestions). This increases analysis time per rotated photo.`,
  faceFeaturesRotationTitle: "Use face features to detect photo rotation",
  faceFeaturesRotationDescription: `Why: EXIF orientation alone is not always enough; faces are a strong hint for “which way is up.”

How: When faces are detected, use the spatial relationship between eyes and nose to verify or correct the suggested rotation direction. Helps prevent upside-down rotation suggestions. May slightly increase analysis time for photos with people.`,
  extractInvoiceDataTitle: "Extract invoice data",
  extractInvoiceDataDescription: `Why: Structured fields are easier to search and reuse than text buried in a long description.

How: If image category is invoice_or_receipt, run a second prompt to extract issuer, invoice number/date, client number, totals, currency, and VAT fields into top-level metadata.document_data.`,
  gpsLocationDetectionTitle: "Detect Country / City from GPS coordinates",
  gpsLocationDetectionDescription: `Why: Photos with GPS coordinates can be automatically tagged with Country, State/Province, and City for use in search filters, folder/album views, and smart albums.

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
  photoAnalysisSettings,
  folderScanningSettings,
  aiImageSearchSettings,
  mediaViewerSettings,
  onFaceDetectionSettingChange,
  onResetFaceDetectionOnlySettings,
  onResetFaceRecognitionOnlySettings,
  onPhotoAnalysisSettingChange,
  onResetPhotoAnalysisSettings,
  onFolderScanningSettingChange,
  onResetFolderScanningSettings,
  onAiImageSearchSettingChange,
  onResetAiImageSearchSettings,
  onMediaViewerSettingChange,
  onResetMediaViewerSettings,
  pathExtractionSettings,
  onPathExtractionSettingChange,
  onResetPathExtractionSettings,
}: DesktopSettingsSectionProps): ReactElement {
  const [showGpsConfirm, setShowGpsConfirm] = useState(false);
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
          <SettingsNumberField
            title="Automatically scan folder for changes on selection if number of files less than"
            description={`Why: Opening a folder can start an automatic metadata and file-identity pass on images in that folder only (not subfolders), which often exceeds 30 seconds when there are many files.

How: If the direct image count in the opened folder is at least this number, that automatic pass is skipped and thumbnails still load. To refresh the catalog yourself, use "${UI_TEXT.scanForFileChanges}" on the folder—leave "Include sub-folders" checked to scan the whole tree under that folder, or turn it off to scan only that folder’s files.`}
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
            description={`Why: Keeping embedded XMP/EXIF in the image file helps other apps (Lightroom, Explorer) see the same rating. Writes go through ExifTool after the catalog is updated.

How: When enabled, changing star rating in the app updates XMP Rating, ModifyDate, MetadataDate, and Windows-friendly EXIF Rating / RatingPercent. Title and description will use the same switch when in-app editors write to files. Turn off if you want the catalog only, or to avoid touching originals.`}
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
          <p className="m-0 text-sm text-muted-foreground md:text-base">
            {UI_TEXT.folderScanWithoutSubfoldersNote}
          </p>
          <p className="m-0 pt-2 text-base font-medium text-foreground">{UI_TEXT.pathFromFilenamesTitle}</p>
          <SettingsCheckboxField
            title={UI_TEXT.pathExtractDatesTitle}
            description={UI_TEXT.pathExtractDatesDescription}
            checked={pathExtractionSettings.extractDates}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={(next) => onPathExtractionSettingChange("extractDates", next)}
          />
          <SettingsCheckboxField
            title={UI_TEXT.pathExtractLocationTitle}
            description={UI_TEXT.pathExtractLocationDescription}
            checked={pathExtractionSettings.extractLocation}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={(next) => onPathExtractionSettingChange("extractLocation", next)}
          />
          <SettingsCheckboxField
            title={UI_TEXT.pathUseLlmTitle}
            description={UI_TEXT.pathUseLlmDescription}
            checked={pathExtractionSettings.useLlm}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={(next) => onPathExtractionSettingChange("useLlm", next)}
          />
          <div
            className={`rounded-md border border-border/70 bg-background/40 p-3 ${!pathExtractionSettings.useLlm ? "opacity-50" : ""}`}
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h4 className="m-0 text-base font-medium text-foreground">{UI_TEXT.pathLlmModelTitle}</h4>
              </div>
              <p className="m-0 text-sm text-muted-foreground">{UI_TEXT.pathLlmModelDescription}</p>
              <input
                type="text"
                disabled={!pathExtractionSettings.useLlm}
                value={pathExtractionSettings.llmModel}
                onChange={(e) => onPathExtractionSettingChange("llmModel", e.target.value)}
                className="mt-1 h-9 w-full max-w-md rounded-md border border-border bg-background px-2 text-base disabled:cursor-not-allowed"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="pt-1">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-md border border-border px-3 text-base"
              onClick={onResetFolderScanningSettings}
              disabled={
                folderScanningSettings.autoMetadataScanOnSelectMaxFiles ===
                  DEFAULT_FOLDER_SCANNING_SETTINGS.autoMetadataScanOnSelectMaxFiles &&
                folderScanningSettings.writeEmbeddedMetadataOnUserEdit ===
                  DEFAULT_FOLDER_SCANNING_SETTINGS.writeEmbeddedMetadataOnUserEdit &&
                folderScanningSettings.detectLocationFromGps ===
                  DEFAULT_FOLDER_SCANNING_SETTINGS.detectLocationFromGps
              }
            >
              {UI_TEXT.resetToDefaults}
            </button>
          </div>
          <div className="pt-1">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-md border border-border px-3 text-base"
              onClick={onResetPathExtractionSettings}
              disabled={
                pathExtractionSettings.extractDates === DEFAULT_PATH_EXTRACTION_SETTINGS.extractDates &&
                pathExtractionSettings.extractLocation === DEFAULT_PATH_EXTRACTION_SETTINGS.extractLocation &&
                pathExtractionSettings.useLlm === DEFAULT_PATH_EXTRACTION_SETTINGS.useLlm &&
                pathExtractionSettings.llmModel === DEFAULT_PATH_EXTRACTION_SETTINGS.llmModel
              }
            >
              {UI_TEXT.resetToDefaults} (path extraction)
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

          <div className="pt-1">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-md border border-border px-3 text-base"
              onClick={onResetFaceDetectionOnlySettings}
              disabled={
                faceDetectionSettings.minConfidenceThreshold ===
                  DEFAULT_FACE_DETECTION_SETTINGS.minConfidenceThreshold &&
                faceDetectionSettings.minFaceBoxShortSideRatio ===
                  DEFAULT_FACE_DETECTION_SETTINGS.minFaceBoxShortSideRatio &&
                faceDetectionSettings.faceBoxOverlapMergeRatio ===
                  DEFAULT_FACE_DETECTION_SETTINGS.faceBoxOverlapMergeRatio
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
                <h4 className="m-0 text-base font-medium text-foreground">
                  {UI_TEXT.photoAnalysisModelTitle}
                </h4>
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                  {UI_TEXT.photoAnalysisModelDescription}
                </p>
              </div>
              <select
                className="h-10 min-w-[260px] rounded-md border border-border bg-background px-2 text-sm text-foreground"
                value={photoAnalysisSettings.model}
                onChange={(event) =>
                  onPhotoAnalysisSettingChange("model", event.target.value)
                }
              >
                {VISION_MODEL_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
          <SettingsCheckboxField
            title={UI_TEXT.twoPassRotationTitle}
            description={UI_TEXT.twoPassRotationDescription}
            checked={photoAnalysisSettings.enableTwoPassRotationConsistency}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={(next) =>
              onPhotoAnalysisSettingChange("enableTwoPassRotationConsistency", next)
            }
          />
          <SettingsCheckboxField
            title={UI_TEXT.faceFeaturesRotationTitle}
            description={UI_TEXT.faceFeaturesRotationDescription}
            checked={photoAnalysisSettings.useFaceFeaturesForRotation}
            checkboxClassName={SETTINGS_OPTION_CHECKBOX_CLASS}
            onChange={(next) =>
              onPhotoAnalysisSettingChange("useFaceFeaturesForRotation", next)
            }
          />
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
                photoAnalysisSettings.enableTwoPassRotationConsistency ===
                  DEFAULT_PHOTO_ANALYSIS_SETTINGS.enableTwoPassRotationConsistency &&
                photoAnalysisSettings.useFaceFeaturesForRotation ===
                  DEFAULT_PHOTO_ANALYSIS_SETTINGS.useFaceFeaturesForRotation &&
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

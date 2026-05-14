import {
  ClipboardList,
  Cpu,
  FileText,
  FolderOpen,
  MapPin,
  MoreHorizontal,
  Scale,
  Search,
  Shapes,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import type { GuidedSlideConfig, GuidedSlideDeck } from "../guided-content/guided-slide-types";
import { OLLAMA_OFFICIAL_DOWNLOAD_URL } from "../../lib/docs-links";

/** Stable slide ids — reusable across welcome, People (?), Settings, future flows. */
export const GUIDED_SLIDE_IDS = {
  welcomeFeatures: "welcome-features",
  privacyLocal: "privacy-local",
  licensesOpenSource: "licenses-open-source-and-models",
  peopleFacesCore: "people-faces-core",
  peopleFacesDeep: "people-faces-deep",
  searchPlainLanguage: "search-plain-language",
  ollamaOverview: "ollama-overview",
  geoDatesRotation: "geolocation-dates-rotation",
  aiImageAnalysis: "ai-image-analysis",
  smartAlbumsOverview: "smart-albums-overview",
  onboardingNextSteps: "onboarding-next-steps",
} as const;

export type GuidedSlideFlowKind = "product-welcome" | "people-faces-help";

export const PRODUCT_WELCOME_SLIDE_ORDER: readonly string[] = [
  GUIDED_SLIDE_IDS.welcomeFeatures,
  GUIDED_SLIDE_IDS.privacyLocal,
  GUIDED_SLIDE_IDS.licensesOpenSource,
  GUIDED_SLIDE_IDS.peopleFacesCore,
  GUIDED_SLIDE_IDS.searchPlainLanguage,
  GUIDED_SLIDE_IDS.ollamaOverview,
  GUIDED_SLIDE_IDS.geoDatesRotation,
  GUIDED_SLIDE_IDS.aiImageAnalysis,
  GUIDED_SLIDE_IDS.smartAlbumsOverview,
  GUIDED_SLIDE_IDS.onboardingNextSteps,
];

export const PEOPLE_FACES_HELP_SLIDE_ORDER: readonly string[] = [
  GUIDED_SLIDE_IDS.peopleFacesCore,
  GUIDED_SLIDE_IDS.peopleFacesDeep,
];

export function buildGuidedSlideDeckFromIds(
  slideIds: readonly string[],
  flow: GuidedSlideFlowKind,
  flowTitle: string,
  deckCategory: GuidedSlideDeck["deckCategory"],
): GuidedSlideDeck {
  const slides = slideIds.map((id) => getGuidedSlideConfig(id, flow));
  return { flowTitle, slides, deckCategory };
}

export function getGuidedSlideConfig(slideId: string, _flow: GuidedSlideFlowKind): GuidedSlideConfig {
  switch (slideId) {
    case GUIDED_SLIDE_IDS.welcomeFeatures:
      return {
        id: slideId,
        slideHeadline: "",
        icon: Sparkles,
        featureHighlights: [
          { icon: Search, label: "Contextual image search" },
          { icon: Users, label: "Face detection and recognition" },
          { icon: Wand2, label: "AI image analysis" },
          {
            icon: Shapes,
            label: "Categorization",
            caption: "documents, screenshots, …",
          },
          { icon: FileText, label: "Invoice & receipt data extraction" },
          { icon: MapPin, label: "Geolocation", caption: "(GPS and AI)" },
          { icon: FolderOpen, label: "Smart albums" },
          { icon: MoreHorizontal, label: "And more" },
        ],
        blocks: [],
      };

    case GUIDED_SLIDE_IDS.privacyLocal:
      return {
        id: slideId,
        slideHeadline: "Data privacy and ownership",
        icon: Sparkles,
        blocks: [
          {
            title: "Fully local",
            body: "Your photos and AI analysis processing stays on this computer. Your data is not sent to the cloud.",
          },
          {
            title: "You own your data",
            body: "Your library database stays under your control. There is no proprietary vendor lock-in when you export or migrate your data.",
          },
        ],
      };

    case GUIDED_SLIDE_IDS.licensesOpenSource:
      return {
        id: slideId,
        slideHeadline: "Software and AI models",
        icon: Scale,
        blocks: [
          {
            title: "Free and open source",
            body: "The application is MIT-licensed: you can use and modify it freely.",
          },
          {
            title: "About AI models",
            body: "AI models used in the app have their own license. Most downloadable vision or language models are open source and open weights, but some have restrictions (for example non‑commercial use only).",
            actionLinks: [{ label: "Models list", actionId: "open-ai-models-reference" }],
          },
        ],
      };

    case GUIDED_SLIDE_IDS.peopleFacesCore:
      return {
        id: slideId,
        slideHeadline: "People and faces",
        icon: Users,
        blocks: [
          {
            title: "Face tagging without the busywork",
            body: "Faces are detected automatically and grouped by similarity. You tag a few people by name; the app proposes the same person tag on similar faces.",
          },
          {
            title: "Filters in search and smart albums",
            body: 'Narrow search to selected people and to how many faces appear in the photo. Combine that with smart albums—for example “best photos of the year” with person A and person B, AI rating ≥ 4★, or manual rating ≥ 3★.',
          },
        ],
      };

    case GUIDED_SLIDE_IDS.peopleFacesDeep:
      return {
        id: slideId,
        slideHeadline: "People in smart albums",
        icon: Users,
        blocks: [
          {
            title: "Combine people with ratings and time",
            body: "Smart album presets can layer people tags with manual star rating and AI aesthetic rating, plus time or location, so recurring views stay useful as the library grows.",
          },
        ],
      };

    case GUIDED_SLIDE_IDS.searchPlainLanguage:
      return {
        id: slideId,
        slideHeadline: "Search in plain language",
        icon: Search,
        blocks: [
          {
            title: "Search with a text prompt",
            body: 'Describe what you are looking for in ordinary words—for example “lady in a white dress near a piano.” The app matches meaning using vision+language understanding of your images, not only file names.',
          },
          {
            title: "Languages",
            body: "Search indexing is English‑oriented: prompts in English only by default. The prompt can be automatically translated to English using a separate text model like Qwen2.5 served by Ollama that must be installed on your machine in this case.",
          },
        ],
      };

    case GUIDED_SLIDE_IDS.ollamaOverview:
      return {
        id: slideId,
        slideHeadline: "Ollama — local AI on this PC",
        icon: Cpu,
        blocks: [
          {
            title: "What is Ollama",
            body: "Ollama is a free, separate application you install on this computer. It runs large language and vision models locally and can be used by this app.",
          },
          {
            title: "How this app uses Ollama",
            body: "Some features like AI image analysis, search prompt translation, and invoice data extraction use AI models hosted by Ollama (Qwen3.5 and Qwen2.5 by default).",
            externalUrl: OLLAMA_OFFICIAL_DOWNLOAD_URL,
          },
        ],
      };

    case GUIDED_SLIDE_IDS.geoDatesRotation:
      return {
        id: slideId,
        slideHeadline: "Geolocation, dates, and straightening",
        icon: MapPin,
        blocks: [
          {
            title: "Geolocation in your local database",
            body: "When photos or videos store GPS coordinates, a local reference database turns them into country, area, and city fields you can filter on. Smart albums can group photos and videos by location—without sending coordinates to a cloud map service.",
          },
          {
            title: "Wrongly rotated and old photos",
            body: "Wrong rotation can be detected and corrected in bulk. For scans or old prints, a built‑in capture date is often missing or does not represent the real photo event date; the app can still infer dates from folder and file names when that embedded camera date is not useful.",
          },
        ],
      };

    case GUIDED_SLIDE_IDS.aiImageAnalysis:
      return {
        id: slideId,
        slideHeadline: "AI image analysis",
        icon: Wand2,
        blocks: [
          {
            title: "Predefined categories for filters",
            body: "Analysis assigns one of several predefined categories (photo, screenshot, document, invoice, and others). You can filter by category—for example hide documents and screenshots when you only want camera photos.",
          },
          {
            title: "AI rating and quality hints",
            body: "An aesthetic (AI) score helps you surface stronger shots—for example inside smart albums. Combine your own star rating with the AI star rating in filters. The AI also flags quality issues such as blur and suggests edits like rotate or crop when it is confident.",
          },
        ],
      };

    case GUIDED_SLIDE_IDS.smartAlbumsOverview:
      return {
        id: slideId,
        slideHeadline: "Smart albums (early stage)",
        icon: FolderOpen,
        blocks: [
          {
            title: "Starter presets today",
            body: "Smart albums are still young: you start from predefined initial presets. Typical combinations group by location or by year, then set filters for people tags plus manual star rating and AI star rating so the set tracks what you care about.",
          },
        ],
      };

    case GUIDED_SLIDE_IDS.onboardingNextSteps:
      return {
        id: slideId,
        slideHeadline: "Next steps",
        icon: ClipboardList,
        blocks: [
          {
            title: "Add media library folder(s)",
            body: "Add a media library root folder from the sidebar and let the full metadata scan complete. That writes file paths, timestamps, and embedded information into the local database.",
          },
          {
            title: "Roll out AI gradually",
            body: "Run AI pipelines on a subset first—for example subfolders with roughly 100–500 images—and start with face detection. When faces appear, assign a handful of people tags and watch how the app clusters similar faces; then use those tags inside search filters together with text prompts.",
          },
        ],
      };

    default:
      throw new Error(`Unknown guided slide id: ${slideId}`);
  }
}

export const OPEN_AI_MODELS_REFERENCE_ACTION = "open-ai-models-reference";
export const OPEN_OLLAMA_INSTALL_DOC_ACTION = "open-ollama-install-doc";

export function handleGuidedSlideDeckAction(actionId: string): "models" | "ollama-doc" | null {
  if (actionId === OPEN_AI_MODELS_REFERENCE_ACTION) {
    return "models";
  }
  if (actionId === OPEN_OLLAMA_INSTALL_DOC_ACTION) {
    return "ollama-doc";
  }
  return null;
}

export function openOllamaInstallDocInBrowser(): void {
  window.open(OLLAMA_OFFICIAL_DOWNLOAD_URL, "_blank", "noopener,noreferrer");
}

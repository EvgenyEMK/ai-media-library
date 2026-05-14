import { FolderOpen, MapPin, Scale, Search, Sparkles, Tag, Users, Wand2 } from "lucide-react";
import type { GuidedSlideConfig } from "../guided-content/guided-slide-types";

/**
 * Variant **c** — paced (~9 slides): one narrow subtopic per slide.
 * Closest to a “micro tutorial” feel for careful readers.
 */
export const PRODUCT_WELCOME_SLIDES_VARIANT_C: readonly GuidedSlideConfig[] = [
  {
    id: "welcome",
    slideHeadline: "Welcome",
    icon: Sparkles,
    blocks: [
      {
        title: "A local AI media library",
        body: "Browse, search, and enrich photos on this device. Your originals and AI results are not tied to a proprietary cloud subscription.",
      },
      {
        title: "Privacy and ownership",
        body: "Processing stays local by default. The project is open source so behavior stays inspectable—you keep control of your library.",
      },
    ],
  },
  {
    id: "licenses",
    slideHeadline: "Open source and models",
    icon: Scale,
    blocks: [
      {
        title: "MIT application",
        body: "You may use and modify this app under the MIT license.",
      },
      {
        title: "Model-specific rules",
        body: "Third-party vision or LLM weights can carry stricter terms. Verify each model’s license if you ship a product or charge customers.",
      },
    ],
  },
  {
    id: "search-prompt",
    slideHeadline: "AI search — what to type",
    icon: Search,
    blocks: [
      {
        title: "Natural descriptions",
        body: 'Examples: “golden retriever on a dock at sunset” or “invoice on a wooden desk.” Short, concrete phrases usually work better than single generic words.',
      },
    ],
  },
  {
    id: "search-language",
    slideHeadline: "AI search — language",
    icon: Search,
    blocks: [
      {
        title: "English-first indexing",
        body: "Indexes are built with English-oriented vision+language models. Optional translation in Advanced search can convert a prompt before matching.",
      },
    ],
  },
  {
    id: "faces-detect",
    slideHeadline: "Faces — detection",
    icon: Users,
    blocks: [
      {
        title: "Automatic detection",
        body: "The scan pass finds faces in images so you do not have to draw boxes by hand.",
      },
    ],
  },
  {
    id: "faces-organize",
    slideHeadline: "Faces — organize and filter",
    icon: Tag,
    blocks: [
      {
        title: "Clusters and tags",
        body: "Similar faces are grouped; confirm a handful of names and let similarity fill the rest. Combine people filters with AI search to narrow huge sets.",
      },
      {
        title: "Demographics",
        body: "Optional age and gender estimates are soft signals—override them whenever they look wrong.",
      },
    ],
  },
  {
    id: "places-time",
    slideHeadline: "Maps, rotation, and dates",
    icon: MapPin,
    blocks: [
      {
        title: "Geo and time hygiene",
        body: "GPS can be shown on a map; reverse geocoding fills readable place names. Wrong orientation can be detected. Path-based date hints help legacy scans.",
      },
    ],
  },
  {
    id: "ai-metadata",
    slideHeadline: "What analysis adds",
    icon: Wand2,
    blocks: [
      {
        title: "Richer metadata",
        body: "Expect categories, aesthetic hints, quality notes, and English blurbs—always editable in your workflow.",
      },
    ],
  },
  {
    id: "albums",
    slideHeadline: "Albums and next step",
    icon: FolderOpen,
    blocks: [
      {
        title: "Manual and smart albums",
        body: "Manual albums plus smart albums driven by people, geography, AI text, and other rules keep curated views in sync.",
      },
      {
        title: "Add your first folder",
        body: "Use the sidebar when you are ready. Close this window any time; your progress is saved.",
      },
    ],
  },
];

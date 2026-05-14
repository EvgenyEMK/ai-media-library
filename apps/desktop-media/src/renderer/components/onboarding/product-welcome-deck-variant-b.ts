import { Compass, FolderOpen, Sparkles, Users } from "lucide-react";
import type { GuidedSlideConfig } from "../guided-content/guided-slide-types";

/**
 * Variant **b** — dense (~4 slides): fewer clicks, more text per slide.
 * Good if you want a quicker first impression with minimal paging.
 */
export const PRODUCT_WELCOME_SLIDES_VARIANT_B: readonly GuidedSlideConfig[] = [
  {
    id: "welcome-dense",
    slideHeadline: "Welcome — local, private, yours",
    icon: Sparkles,
    blocks: [
      {
        title: "Why this app exists",
        body: "Keep a large photo library on your computer with local AI: search in your own words, organize people, map places, fix rotations, and spot documents—without handing originals to a proprietary cloud. The app is MIT open source; you own your data.",
      },
      {
        title: "Models and licenses",
        body: "The program is free to use and modify. Downloadable AI models may add their own rules (for example non‑commercial only)—read each model’s license before business use.",
      },
    ],
  },
  {
    id: "search-and-ai",
    slideHeadline: "Search and understanding",
    icon: Compass,
    blocks: [
      {
        title: "Prompted search",
        body: 'Describe a scene (“two kids on a red sled”) in English for best results. Advanced search can translate other languages to English before matching.',
      },
      {
        title: "Beyond search",
        body: "The same analysis pass can label kinds of content, estimate quality or appeal, suggest crops, and add a concise English caption—always stored locally.",
      },
    ],
  },
  {
    id: "people-and-albums",
    slideHeadline: "People and albums",
    icon: Users,
    blocks: [
      {
        title: "Faces",
        body: "Faces are found automatically, clustered by similarity, and you only tag a few identities to unlock bulk suggestions. Filter by person together with AI search.",
      },
      {
        title: "Albums",
        body: "Create albums manually or with smart rules (people, geography, AI queries, ratings) so galleries update as new photos arrive.",
      },
    ],
  },
  {
    id: "places-setup",
    slideHeadline: "Places, dates, and getting started",
    icon: FolderOpen,
    blocks: [
      {
        title: "Time and map context",
        body: "GPS metadata feeds maps; wrong rotations can be corrected in batch; missing EXIF can sometimes be recovered from folder paths for older scans.",
      },
      {
        title: "Add your first folder",
        body: "Use the sidebar to add a library folder, then run metadata scan and the AI jobs you care about from the folder menu or pipeline queue.",
      },
    ],
  },
];

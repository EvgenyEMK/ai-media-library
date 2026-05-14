import { Cpu, FileText, ListFilter, Sparkles } from "lucide-react";
import type { GuidedSlideConfig, GuidedSlideDeck } from "../guided-content/guided-slide-types";

/**
 * Slide deck variants for Invoices & Receipts help (and future onboarding reuse).
 *
 * - **a** — Three steps: overview with extraction list → data checks & filters → Ollama / model (default).
 * - **b** — Three steps: one dense overview (categories + extraction list + DB/filters hint) → accuracy & filter tips → Ollama.
 * - **c** — Five steps: one narrow topic per slide for slower, guided pacing.
 *
 * Switch the default in `DEFAULT_INVOICES_RECEIPTS_HELP_VARIANT`, or pass `contentVariant` to `InvoicesReceiptsHelpModal`.
 */
export type InvoicesReceiptsHelpVariant = "a" | "b" | "c";

/** Change this to compare variants in the UI (or pass `contentVariant` from the modal). */
export const DEFAULT_INVOICES_RECEIPTS_HELP_VARIANT: InvoicesReceiptsHelpVariant = "a";

const FLOW_TITLE = "Invoices & Receipts";

const EXTRACTED_FIELD_ITEMS = [
  "Issuer (invoice from)",
  "Document date",
  "Total amount and currency",
  "VAT",
] as const;

function ollamaSlide(effectivePhotoAnalysisModel: string): GuidedSlideConfig {
  return {
    id: "ollama-model",
    slideHeadline: "Image analysis - AI model",
    icon: Cpu,
    blocks: [
      {
        title: "Image AI runs through Ollama on this computer",
        body: "All image analysis in this app—including grouping photos, spotting documents such as receipts, and reading text from them—uses Ollama, a free local AI runner. Install Ollama on this machine and start it before you run folder analysis.",
      },
      {
        title: "Choose the vision model in Settings",
        body: `Open Settings → AI image analysis → AI model. This library is currently set to “${effectivePhotoAnalysisModel}”. You can switch to another installed model there depending on how much accuracy or speed you want.`,
      },
    ],
  };
}

/** Three steps: overview with extraction list → data checks & quick search → Ollama (generic). */
function buildVariantA(effectivePhotoAnalysisModel: string): readonly GuidedSlideConfig[] {
  return [
    {
      id: "a-overview",
      slideHeadline: "Automatic detection and data extraction from your photos",
      icon: Sparkles,
      blocks: [
        {
          title: "Automatic document category",
          body: "AI image analysis automatically detects documents like IDs, invoices, receipts, and other.",
        },
        {
          title: "Extracted fields",
          body: "For invoices and receipts, the analysis tries to extract the following data:",
          listItems: EXTRACTED_FIELD_ITEMS,
        },
      ],
    },
    {
      id: "a-search-consistency",
      slideHeadline: "Quick search and data consistency check",
      icon: ListFilter,
      blocks: [
        {
          title: "Data check",
          body: "AI extracted data are not 100% reliable. The app checks some data inconsistencies and warns if detected (for example, if VAT does not match total).",
        },
        {
          title: "Quick search filters",
          body: "You can quickly find your document with filters by dates, amount, and issuer name.",
        },
      ],
    },
    ollamaSlide(effectivePhotoAnalysisModel),
  ];
}

/** Three steps: one dense first slide, then accuracy/filters, then Ollama. */
function buildVariantB(effectivePhotoAnalysisModel: string): readonly GuidedSlideConfig[] {
  return [
    {
      id: "b-overview",
      slideHeadline: "Automatic detection and data extraction from your photos",
      icon: Sparkles,
      blocks: [
        {
          title: "Detects categories and document photos",
          body: "Image analysis walks your library and labels useful kinds of content, including IDs, invoices, receipts, and other documents sitting next to everyday photos.",
        },
        {
          title: "Pulls common invoice and receipt fields",
          body: "When a shot looks like a bill, the app tries to fill table columns automatically:",
          listItems: EXTRACTED_FIELD_ITEMS,
        },
        {
          title: "Saved locally and filterable from here",
          body: "Those fields live in your local database. Use the filters on this screen (issuer, dates, totals, currency) to shrink a long list down to the few rows you care about.",
        },
      ],
    },
    {
      id: "b-trust-filters",
      slideHeadline: "Accuracy and how filters help",
      icon: ListFilter,
      blocks: [
        {
          title: "Verify anything that matters",
          body: "Lighting, motion blur, or a folded corner can confuse text recognition. If a total or VAT line looks surprising, open the thumbnail and compare to the paper.",
        },
        {
          title: "Combine filters like a short questionnaire",
          body: "Start broad—issuer contains a company name—then tighten with a date window or currency if you still have too many hits.",
        },
      ],
    },
    ollamaSlide(effectivePhotoAnalysisModel),
  ];
}

/** Five steps: one narrow topic per slide for onboarding-style pacing. */
function buildVariantC(effectivePhotoAnalysisModel: string): readonly GuidedSlideConfig[] {
  return [
    {
      id: "c-categories",
      slideHeadline: "What image analysis adds first",
      icon: Sparkles,
      blocks: [
        {
          title: "Automatic grouping by what is in the frame",
          body: "Analysis tags each image with high-level categories so the library is easier to browse than a flat folder of filenames.",
        },
        {
          title: "Document shots are called out explicitly",
          body: "That same pass notices when a photo is probably paperwork rather than a vacation snapshot, which unlocks the invoice and receipt workflow you are in now.",
        },
      ],
    },
    {
      id: "c-doc-types",
      slideHeadline: "Documents this flow cares about",
      icon: FileText,
      blocks: [
        {
          title: "IDs, invoices, receipts, and similar scans",
          body: "The model looks for common administrative layouts—IDs, formal invoices, shop receipts, and other “paper in the photo” cases—so they can be listed separately from general albums.",
        },
      ],
    },
    {
      id: "c-extract",
      slideHeadline: "Fields we try to copy from each slip",
      icon: FileText,
      blocks: [
        {
          title: "Table columns come from these ideas",
          body: "Each analyzed receipt or invoice may contribute some or all of the following:",
          listItems: EXTRACTED_FIELD_ITEMS,
        },
      ],
    },
    {
      id: "c-db",
      slideHeadline: "Where the answers live after analysis",
      icon: ListFilter,
      blocks: [
        {
          title: "Stored in your local database",
          body: "Once analysis has run, values are stored locally with your catalog so you can reopen this view anytime without re-reading every file from scratch.",
        },
        {
          title: "Filters are the fast path to one row",
          body: "Issuer, date range, amount range, and currency are the main knobs for hunting down a specific purchase.",
        },
      ],
    },
    ollamaSlide(effectivePhotoAnalysisModel),
  ];
}

export function buildInvoicesReceiptsHelpDeck(
  variant: InvoicesReceiptsHelpVariant,
  effectivePhotoAnalysisModel: string,
): GuidedSlideDeck {
  const slides =
    variant === "b"
      ? buildVariantB(effectivePhotoAnalysisModel)
      : variant === "c"
        ? buildVariantC(effectivePhotoAnalysisModel)
        : buildVariantA(effectivePhotoAnalysisModel);
  return { flowTitle: FLOW_TITLE, slides, deckCategory: "feature-help" };
}

export function invoicesReceiptsHelpSlideCount(variant: InvoicesReceiptsHelpVariant): number {
  return buildInvoicesReceiptsHelpDeck(variant, "model").slides.length;
}

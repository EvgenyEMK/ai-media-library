/** Top-level section that owns the main workspace (Insights is expand-only, not primary). */
export type PrimarySidebarSectionId = "folders" | "albums" | "people" | "settings";

/** Sections whose tree can be expanded in the sidebar (includes Insights and Documents). */
export type ExpandedSidebarSectionId = PrimarySidebarSectionId | "insights" | "documents";

/** Which Insights inner row is selected (highlights row; drives hub or direct actions). */
export type InsightsSidebarSubSection = "duplicate-files" | "folder-analysis-status";

/** Which Documents inner row is selected (drives main-pane workspace). */
export type DocumentsSidebarSubSection = "invoices-receipts";

export type MainPaneViewMode = "media" | "imageEditSuggestions" | "folderAiSummary";

export interface RotationReviewScope {
  folderPath: string;
  includeSubfolders: boolean;
}
export type AlbumWorkspaceMode = "list" | "create" | "detail" | "smart";

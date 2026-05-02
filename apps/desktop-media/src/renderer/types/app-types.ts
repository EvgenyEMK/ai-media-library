export type SidebarSectionId = "folders" | "albums" | "people" | "settings";
export type MainPaneViewMode = "media" | "imageEditSuggestions" | "folderAiSummary";

export interface RotationReviewScope {
  folderPath: string;
  includeSubfolders: boolean;
}
export type AlbumWorkspaceMode = "list" | "create" | "detail" | "smart";

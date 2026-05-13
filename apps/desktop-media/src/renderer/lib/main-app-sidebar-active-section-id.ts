import type {
  DocumentsSidebarSubSection,
  InsightsSidebarSubSection,
  PrimarySidebarSectionId,
} from "../types/app-types";

/** Resolves `MainAppSidebar` `activeSectionId` (parent row highlight). */
export function resolveMainAppSidebarActiveSectionId(args: {
  sidebarCollapsed: boolean;
  primarySidebarSection: PrimarySidebarSectionId;
  documentsSubSection: DocumentsSidebarSubSection | null;
  insightsSubSection: InsightsSidebarSubSection | null;
}): PrimarySidebarSectionId | "documents" | "insights" | null {
  const { sidebarCollapsed, primarySidebarSection, documentsSubSection, insightsSubSection } = args;
  if (sidebarCollapsed) {
    if (documentsSubSection !== null) return "documents";
    if (insightsSubSection !== null) return "insights";
    return primarySidebarSection;
  }
  if (documentsSubSection !== null || insightsSubSection !== null) {
    return null;
  }
  return primarySidebarSection;
}

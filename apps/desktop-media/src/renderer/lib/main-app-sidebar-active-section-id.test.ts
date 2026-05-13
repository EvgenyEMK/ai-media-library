import { describe, expect, it } from "vitest";
import { resolveMainAppSidebarActiveSectionId } from "./main-app-sidebar-active-section-id";

describe("resolveMainAppSidebarActiveSectionId", () => {
  it("returns null in expanded sidebar when a Documents or Insights child is active", () => {
    expect(
      resolveMainAppSidebarActiveSectionId({
        sidebarCollapsed: false,
        primarySidebarSection: "folders",
        documentsSubSection: "invoices-receipts",
        insightsSubSection: null,
      }),
    ).toBeNull();
    expect(
      resolveMainAppSidebarActiveSectionId({
        sidebarCollapsed: false,
        primarySidebarSection: "folders",
        documentsSubSection: null,
        insightsSubSection: "duplicate-files",
      }),
    ).toBeNull();
  });

  it("highlights Documents or Insights parent when sidebar is collapsed and a child is active", () => {
    expect(
      resolveMainAppSidebarActiveSectionId({
        sidebarCollapsed: true,
        primarySidebarSection: "folders",
        documentsSubSection: "invoices-receipts",
        insightsSubSection: null,
      }),
    ).toBe("documents");
    expect(
      resolveMainAppSidebarActiveSectionId({
        sidebarCollapsed: true,
        primarySidebarSection: "albums",
        documentsSubSection: null,
        insightsSubSection: "folder-analysis-status",
      }),
    ).toBe("insights");
  });

  it("uses primary section when collapsed and no document/insight child is active", () => {
    expect(
      resolveMainAppSidebarActiveSectionId({
        sidebarCollapsed: true,
        primarySidebarSection: "people",
        documentsSubSection: null,
        insightsSubSection: null,
      }),
    ).toBe("people");
  });

  it("uses primary section when expanded and no document/insight child is active", () => {
    expect(
      resolveMainAppSidebarActiveSectionId({
        sidebarCollapsed: false,
        primarySidebarSection: "settings",
        documentsSubSection: null,
        insightsSubSection: null,
      }),
    ).toBe("settings");
  });
});

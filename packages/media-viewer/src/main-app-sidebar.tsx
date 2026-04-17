"use client";

import type { ReactElement, ReactNode } from "react";

function joinClasses(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export interface MainAppSidebarSection {
  id: string;
  label: string;
  icon: ReactNode;
  /** Shown to the right of the section label when the sidebar is expanded (e.g. add action). */
  headerTrailing?: ReactNode;
  content?: ReactNode;
  /** Extra classes for the expanded section scroll container (after default `p-2`, etc.). */
  contentClassName?: string;
}

interface MainAppSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  expandLabel: string;
  collapseLabel: string;
  expandIcon: ReactNode;
  collapseIcon: ReactNode;
  sections: MainAppSidebarSection[];
  bottomSections?: MainAppSidebarSection[];
  activeSectionId: string | null;
  expandedSectionId: string | null;
  onSectionToggle: (sectionId: string) => void;
}

export function MainAppSidebar({
  collapsed,
  onToggleCollapsed,
  expandLabel,
  collapseLabel,
  expandIcon,
  collapseIcon,
  sections,
  bottomSections = [],
  activeSectionId,
  expandedSectionId,
  onSectionToggle,
}: MainAppSidebarProps): ReactElement {
  const collapseTitle = collapsed ? expandLabel : collapseLabel;
  const renderSection = (section: MainAppSidebarSection): ReactElement => {
    const isActive = section.id === activeSectionId;
    const isExpanded = !collapsed && section.id === expandedSectionId;
    const splitHeader = !collapsed && section.headerTrailing;

    return (
      <div key={section.id} className="space-y-1">
        {splitHeader ? (
          <div
            className={joinClasses(
              "flex w-full min-w-0 items-stretch overflow-hidden rounded-md border text-base",
              isActive ? "border-primary bg-primary/10 text-foreground" : "border-border",
            )}
          >
            <button
              type="button"
              onClick={() => onSectionToggle(section.id)}
              title={section.label}
              aria-label={section.label}
              aria-expanded={isExpanded}
              className={joinClasses(
                "inline-flex h-10 min-w-0 flex-1 items-center border-0 bg-transparent px-3 text-left text-inherit shadow-none outline-none",
                "justify-start",
              )}
            >
              <span className="mr-2" aria-hidden="true">
                {section.icon}
              </span>
              {section.label}
            </button>
            <div
              className={joinClasses(
                "flex shrink-0 items-stretch border-l [&:empty]:hidden",
                isActive ? "border-primary/30" : "border-border/60",
              )}
            >
              {section.headerTrailing}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onSectionToggle(section.id)}
            title={section.label}
            aria-label={section.label}
            aria-expanded={isExpanded}
            className={joinClasses(
              "inline-flex h-10 w-full items-center rounded-md border px-3 text-base",
              collapsed ? "justify-center" : "justify-start",
              isActive ? "border-primary bg-primary/10 text-foreground" : "border-border",
            )}
          >
            <span className={collapsed ? "" : "mr-2"} aria-hidden="true">
              {section.icon}
            </span>
            {!collapsed ? section.label : null}
          </button>
        )}
        {isExpanded && section.content ? (
          <div
            className={joinClasses(
              "min-h-0 max-h-[60vh] overflow-auto rounded-md border border-border/70 p-2",
              section.contentClassName,
            )}
          >
            {section.content}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <button
        type="button"
        onClick={onToggleCollapsed}
        title={collapseTitle}
        aria-label={collapseTitle}
        className={joinClasses(
          "inline-flex h-9 w-full items-center border-0 bg-transparent p-0 text-foreground shadow-none outline-none",
          collapsed ? "justify-center" : "justify-start",
        )}
      >
        {collapsed ? expandIcon : collapseIcon}
      </button>

      <nav className="flex min-h-0 flex-1 flex-col gap-1">
        {sections.map(renderSection)}
        {bottomSections.length > 0 ? (
          <div className="mt-auto space-y-1 border-t border-border/60 pt-2">
            {bottomSections.map(renderSection)}
          </div>
        ) : null}
      </nav>
    </div>
  );
}

// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MainAppSidebar } from "./main-app-sidebar";

describe("MainAppSidebar", () => {
  afterEach(cleanup);

  it("renders expanded content with active spacing and plain chrome", () => {
    render(
      <MainAppSidebar
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        expandLabel="Expand"
        collapseLabel="Collapse"
        expandIcon={<span>expand</span>}
        collapseIcon={<span>collapse</span>}
        activeSectionId="albums"
        expandedSectionId="albums"
        onSectionToggle={vi.fn()}
        sections={[
          {
            id: "albums",
            label: "Albums",
            icon: <span aria-hidden="true">A</span>,
            contentChrome: "plain",
            content: <div>Album content</div>,
          },
          {
            id: "people",
            label: "People",
            icon: <span aria-hidden="true">P</span>,
          },
        ]}
      />,
    );

    expect(screen.getByText("Album content").parentElement).not.toHaveClass("border");
    expect(screen.getByText("Album content").closest(".space-y-1")).toHaveClass("mb-4");
  });

  it("does not render expanded content spacing in collapsed mode", () => {
    render(
      <MainAppSidebar
        collapsed
        onToggleCollapsed={vi.fn()}
        expandLabel="Expand"
        collapseLabel="Collapse"
        expandIcon={<span>expand</span>}
        collapseIcon={<span>collapse</span>}
        activeSectionId="albums"
        expandedSectionId="albums"
        onSectionToggle={vi.fn()}
        sections={[
          {
            id: "albums",
            label: "Albums",
            icon: <span aria-hidden="true">A</span>,
            content: <div>Album content</div>,
          },
        ]}
      />,
    );

    expect(screen.queryByText("Album content")).toBeNull();
    expect(screen.getByTitle("Albums").parentElement).not.toHaveClass("mb-4");
  });

  it("calls onSectionToggle from section headers", () => {
    const onSectionToggle = vi.fn();
    render(
      <MainAppSidebar
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        expandLabel="Expand"
        collapseLabel="Collapse"
        expandIcon={<span>expand</span>}
        collapseIcon={<span>collapse</span>}
        activeSectionId="albums"
        expandedSectionId={null}
        onSectionToggle={onSectionToggle}
        sections={[
          {
            id: "albums",
            label: "Albums",
            icon: <span aria-hidden="true">A</span>,
            headerTrailing: <button type="button">Add</button>,
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Albums" }));

    expect(onSectionToggle).toHaveBeenCalledWith("albums");
  });
});

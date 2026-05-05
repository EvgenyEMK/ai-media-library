// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PhotoWithInfoPanel } from "./photo-with-info-panel";

describe("PhotoWithInfoPanel", () => {
  afterEach(cleanup);

  const tabs = [
    { id: "info", label: "Info", content: <div>Info body</div> },
    { id: "tags", label: "Face tags", content: <div>Tags body</div> },
    { id: "metadata", label: "Metadata", content: <div>Meta body</div> },
  ];

  it("does not render close control when onClosePanel is omitted", () => {
    render(<PhotoWithInfoPanel tabs={tabs} imageUrl="https://example.com/x.jpg" />);
    expect(screen.queryByRole("button", { name: "Close info panel" })).not.toBeInTheDocument();
  });

  it("calls onClosePanel when close button is activated", () => {
    const onClosePanel = vi.fn();
    render(
      <PhotoWithInfoPanel tabs={tabs} imageUrl="https://example.com/x.jpg" onClosePanel={onClosePanel} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close info panel" }));
    expect(onClosePanel).toHaveBeenCalledTimes(1);
  });
});

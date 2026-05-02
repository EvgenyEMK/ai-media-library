// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PeopleDeleteConfirmDialog } from "./PeopleDeleteConfirmDialog";

describe("PeopleDeleteConfirmDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows title with person name and stats on one line", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <PeopleDeleteConfirmDialog
        open
        label="Alex"
        faceCount={3}
        mediaItemCount={2}
        isBusy={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole("heading", { name: "Delete Alex ?" })).toBeInTheDocument();
    const statsLine = screen.getByText(/Face tags: 3/).closest("p");
    expect(statsLine?.textContent).toContain("Face tags: 3");
    expect(statsLine?.textContent).toContain("Media items: 2");
  });

  it("invokes cancel when Cancel is clicked", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <PeopleDeleteConfirmDialog
        open
        label="Pat"
        faceCount={0}
        mediaItemCount={0}
        isBusy={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

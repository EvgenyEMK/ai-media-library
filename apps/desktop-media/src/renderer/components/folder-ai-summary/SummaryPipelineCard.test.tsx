// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RotateCw } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SummaryPipelineCard } from "./SummaryPipelineCard";

describe("SummaryPipelineCard", () => {
  afterEach(cleanup);

  it("renders rotation failures and counts them as processed in the card progress", () => {
    render(
      <SummaryPipelineCard
        icon={RotateCw}
        title="Wrongly rotated images"
        pipeline={{
          doneCount: 0,
          failedCount: 2,
          totalImages: 10,
          label: "partial",
          issueCount: 0,
        }}
        actionPipeline="rotation"
        onRunPipeline={vi.fn()}
        completedLabel="Analyzed"
        issueLabel="Wrongly rotated"
      />,
    );

    expect(screen.getByText("20%")).toBeVisible();
    expect(screen.getByText("To analyze")).toBeVisible();
    expect(screen.getByText("8")).toBeVisible();
    expect(screen.getByText("Failed")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();
  });

  it("shows a spinner instead of the play icon while the run action is pending", () => {
    const { container } = render(
      <SummaryPipelineCard
        icon={RotateCw}
        title="Wrongly rotated images"
        pipeline={{
          doneCount: 0,
          failedCount: 0,
          totalImages: 10,
          label: "not_done",
          issueCount: 0,
        }}
        actionPipeline="rotation"
        actionPending
        onRunPipeline={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Wrongly rotated images is running" })).toBeDisabled();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });
});

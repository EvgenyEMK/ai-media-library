// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SummaryStatusLines } from "./SummaryStatusLines";

describe("SummaryStatusLines", () => {
  afterEach(cleanup);

  it("shows failed count and excludes failures from the to-analyze remainder", () => {
    render(
      <SummaryStatusLines
        pipeline={{
          doneCount: 3,
          failedCount: 2,
          totalImages: 10,
          label: "partial",
        }}
        tone="amber"
      />,
    );

    expect(screen.getByText("To analyze")).toBeVisible();
    expect(screen.getByText("5")).toBeVisible();
    expect(screen.getByText("Failed")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();
  });
});

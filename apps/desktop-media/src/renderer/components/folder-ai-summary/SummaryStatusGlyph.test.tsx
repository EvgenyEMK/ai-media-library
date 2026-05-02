// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SummaryStatusGlyph } from "./SummaryStatusGlyph";

describe("SummaryStatusGlyph", () => {
  afterEach(cleanup);

  it("counts failed items as processed when showing partial progress", () => {
    render(
      <SummaryStatusGlyph
        pipeline={{
          doneCount: 3,
          failedCount: 2,
          totalImages: 10,
          label: "partial",
        }}
      />,
    );

    expect(screen.getByText("50%")).toBeVisible();
  });
});

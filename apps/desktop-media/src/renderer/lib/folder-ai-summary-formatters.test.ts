import { describe, expect, it } from "vitest";
import {
  formatFolderTreeScanCoveragePercentDisplay,
  formatCoveragePercent,
} from "./folder-ai-summary-formatters";

describe("formatFolderTreeScanCoveragePercentDisplay", () => {
  it("shows 99% instead of rounded 100% when files still need catalog updates", () => {
    expect(formatFolderTreeScanCoveragePercentDisplay(2489, 2489, 3)).toBe("99%");
    expect(formatCoveragePercent(2489, 2489)).toBe("100%");
  });

  it("keeps true 100% when there are no pending file updates", () => {
    expect(formatFolderTreeScanCoveragePercentDisplay(2489, 2489, 0)).toBe("100%");
  });
});

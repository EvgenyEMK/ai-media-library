import { describe, it, expect } from "vitest";
import {
  formatDuplicateShareInScanScopePercent,
  formatFolderTableDuplicateSize,
  formatMbOrGbForDeleteConfirm,
  formatStorageSizeForDuplicateMetricCards,
} from "./duplicate-files-metric-formatters";

describe("formatStorageSizeForDuplicateMetricCards", () => {
  it("uses GB with one decimal when size is at least 1 GB", () => {
    const oneGb = 1024 ** 3;
    expect(formatStorageSizeForDuplicateMetricCards(oneGb)).toBe("1.0 GB");
    expect(formatStorageSizeForDuplicateMetricCards(2.5 * oneGb)).toBe("2.5 GB");
  });

  it("uses MB below 1 GB", () => {
    expect(formatStorageSizeForDuplicateMetricCards(512 * 1024 * 1024)).toBe("512 MB");
  });
});

describe("formatFolderTableDuplicateSize", () => {
  it("uses Gb with two decimals under 10 Gb", () => {
    expect(formatFolderTableDuplicateSize(1.34 * 1024 ** 3)).toBe("1.34 Gb");
  });

  it("uses Mb for sizes under 1 Gb", () => {
    expect(formatFolderTableDuplicateSize(250 * 1024 ** 2)).toBe("250 Mb");
  });

  it("uses Kb below 1 Mb", () => {
    expect(formatFolderTableDuplicateSize(512 * 1024)).toBe("512 Kb");
  });

  it("returns zero Kb for non-positive", () => {
    expect(formatFolderTableDuplicateSize(0)).toBe("0 Kb");
  });
});

describe("formatMbOrGbForDeleteConfirm", () => {
  it("matches GB threshold like metric cards", () => {
    const oneGb = 1024 ** 3;
    expect(formatMbOrGbForDeleteConfirm(oneGb)).toBe("1.0 GB");
  });

  it("uses MB below 1 GB", () => {
    expect(formatMbOrGbForDeleteConfirm(5 * 1024 * 1024)).toBe("5.00 MB");
  });
});

describe("formatDuplicateShareInScanScopePercent", () => {
  it("returns loading when total is unknown", () => {
    expect(formatDuplicateShareInScanScopePercent(3, null).loading).toBe(true);
  });

  it("computes percent against scan scope total", () => {
    expect(formatDuplicateShareInScanScopePercent(1, 4).primaryText).toBe("25.0%");
  });
});

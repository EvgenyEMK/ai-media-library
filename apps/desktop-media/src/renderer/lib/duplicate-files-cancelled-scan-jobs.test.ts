import { describe, expect, it } from "vitest";
import {
  consumeDuplicateScanJobCancelRequested,
  markDuplicateScanJobCancelRequested,
} from "./duplicate-files-cancelled-scan-jobs";

describe("duplicate-files-cancelled-scan-jobs", () => {
  it("consumes a marked duplicate scan job once", () => {
    markDuplicateScanJobCancelRequested("job-1");

    expect(consumeDuplicateScanJobCancelRequested("job-1")).toBe(true);
    expect(consumeDuplicateScanJobCancelRequested("job-1")).toBe(false);
  });

  it("ignores empty job ids", () => {
    markDuplicateScanJobCancelRequested(null);
    markDuplicateScanJobCancelRequested(undefined);

    expect(consumeDuplicateScanJobCancelRequested("")).toBe(false);
  });
});


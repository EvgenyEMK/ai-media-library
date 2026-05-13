import { describe, expect, it } from "vitest";
import { bucketWeakDuplicateRows, weakDuplicateFingerprint } from "./folder-duplicate-scan-weak";

describe("weakDuplicateFingerprint", () => {
  it("returns null when byte size is missing", () => {
    expect(
      weakDuplicateFingerprint({
        source_path: "/a/Photo.jpg",
        byte_size: null,
        file_mtime_ms: 100,
      }),
    ).toBeNull();
  });

  it("returns null when mtime is missing", () => {
    expect(
      weakDuplicateFingerprint({
        source_path: "/a/Photo.jpg",
        byte_size: 99,
        file_mtime_ms: null,
      }),
    ).toBeNull();
  });

  it("uses case-insensitive basename with size and mtime", () => {
    const a = weakDuplicateFingerprint({
      source_path: "/x/Photo.jpg",
      byte_size: 1000,
      file_mtime_ms: 5,
    });
    const b = weakDuplicateFingerprint({
      source_path: "/y/photo.jpg",
      byte_size: 1000,
      file_mtime_ms: 5,
    });
    expect(a).toBe(b);
  });
});

describe("bucketWeakDuplicateRows", () => {
  it("only includes buckets with two or more rows when filtered by caller", () => {
    const rows = [
      { source_path: "/a/x.jpg", byte_size: 1, file_mtime_ms: 1 },
      { source_path: "/b/x.jpg", byte_size: 1, file_mtime_ms: 1 },
      { source_path: "/c/y.jpg", byte_size: 2, file_mtime_ms: 2 },
    ];
    const buckets = bucketWeakDuplicateRows(rows);
    expect(buckets.get(weakDuplicateFingerprint(rows[0]!)!)?.length).toBe(2);
    expect(buckets.get(weakDuplicateFingerprint(rows[2]!)!)?.length).toBe(1);
  });
});

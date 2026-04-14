import { describe, it, expect } from "vitest";
import { resolveEventDate } from "./event-date-resolver";
import type { PathDateExtraction } from "./types";

const noExif = { photoTakenAt: null, photoTakenPrecision: null } as const;
const noFile = { fileCreatedAt: null } as const;

function pathDate(
  start: string,
  end: string | null = null,
  precision: "year" | "month" | "day" = "day",
): PathDateExtraction {
  return { start, end, precision, source: "script_filename" };
}

describe("resolveEventDate", () => {
  it("uses EXIF when only EXIF available", () => {
    const r = resolveEventDate(
      { photoTakenAt: "2020-03-06T18:51:30", photoTakenPrecision: "instant" },
      null,
      noFile,
    );
    expect(r).toEqual({
      start: "2020-03-06T18:51:30",
      end: null,
      precision: "instant",
      source: "exif",
    });
  });

  it("uses path date when only path available", () => {
    const r = resolveEventDate(
      noExif,
      pathDate("1994-09", null, "month"),
      noFile,
    );
    expect(r).toEqual({
      start: "1994-09",
      end: null,
      precision: "month",
      source: "path_script",
    });
  });

  it("prefers EXIF when path year >= EXIF year", () => {
    const r = resolveEventDate(
      { photoTakenAt: "2009-02-07", photoTakenPrecision: "day" },
      pathDate("2009-02-07"),
      noFile,
    );
    expect(r?.source).toBe("exif");
    expect(r?.start).toBe("2009-02-07");
  });

  it("prefers path date when path year < EXIF year (scanned photo)", () => {
    const r = resolveEventDate(
      { photoTakenAt: "2020-05-15", photoTakenPrecision: "day" },
      pathDate("1975-08", null, "month"),
      noFile,
    );
    expect(r?.source).toBe("path_script");
    expect(r?.start).toBe("1975-08");
    expect(r?.precision).toBe("month");
  });

  it("uses path date with range", () => {
    const r = resolveEventDate(
      noExif,
      pathDate("1982", "1991", "year"),
      noFile,
    );
    expect(r).toEqual({
      start: "1982",
      end: "1991",
      precision: "year",
      source: "path_script",
    });
  });

  it("falls back to file mtime when no other sources", () => {
    const r = resolveEventDate(noExif, null, {
      fileCreatedAt: "2023-01-15",
    });
    expect(r).toEqual({
      start: "2023-01-15",
      end: null,
      precision: "day",
      source: "file_mtime",
    });
  });

  it("returns null when nothing available", () => {
    const r = resolveEventDate(noExif, null, noFile);
    expect(r).toBeNull();
  });

  it("uses path_llm source for LLM-extracted dates", () => {
    const pd: PathDateExtraction = {
      start: "1994-09",
      end: null,
      precision: "month",
      source: "llm_path",
    };
    const r = resolveEventDate(noExif, pd, noFile);
    expect(r?.source).toBe("path_llm");
  });
});

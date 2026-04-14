import { describe, it, expect } from "vitest";
import { extractDateFromSegment, extractDateFromPath } from "./date-extractor";

describe("extractDateFromSegment", () => {
  it("extracts YYYY-MM-DD at start", () => {
    const r = extractDateFromSegment("2009-02-07 Misha Kalinin birthday party");
    expect(r).toEqual({
      start: "2009-02-07",
      end: null,
      precision: "day",
      rawMatch: "2009-02-07",
    });
  });

  it("extracts compact YYYYMMDD_HHMMSS", () => {
    const r = extractDateFromSegment("20200306_185130");
    expect(r?.start).toBe("2020-03-06");
    expect(r?.precision).toBe("day");
  });

  it("extracts IMG_ prefixed compact date", () => {
    const r = extractDateFromSegment("IMG_20200306_185130");
    expect(r?.start).toBe("2020-03-06");
    expect(r?.precision).toBe("day");
  });

  it("extracts standalone year from middle of text", () => {
    const r = extractDateFromSegment("JTI IT team 1999 Zelenogorsk");
    expect(r).toEqual({
      start: "1999",
      end: null,
      precision: "year",
      rawMatch: "1999",
    });
  });

  it("extracts YYYY-MM partial date", () => {
    const r = extractDateFromSegment("1994-09 Группа ЛЭТИ");
    expect(r).toEqual({
      start: "1994-09",
      end: null,
      precision: "month",
      rawMatch: "1994-09",
    });
  });

  it("extracts year range YYYY-YYYY", () => {
    const r = extractDateFromSegment("1992-1998 Группа университета");
    expect(r).toEqual({
      start: "1992",
      end: "1998",
      precision: "year",
      rawMatch: "1992-1998",
    });
  });

  it("extracts year range with spaces YYYY - YYYY", () => {
    const r = extractDateFromSegment("1992 - 1998 Группа");
    expect(r?.start).toBe("1992");
    expect(r?.end).toBe("1998");
    expect(r?.precision).toBe("year");
  });

  it("extracts short year range YYYY--YY", () => {
    const r = extractDateFromSegment("1982--91 School 481");
    expect(r).toEqual({
      start: "1982",
      end: "1991",
      precision: "year",
      rawMatch: "1982--91",
    });
  });

  it("extracts short year range with spaces YYYY -- YY", () => {
    const r = extractDateFromSegment("1982 -- 91 School");
    expect(r?.start).toBe("1982");
    expect(r?.end).toBe("1991");
  });

  it("extracts day span range YYYY-MM-DD -- DD", () => {
    const r = extractDateFromSegment("1997-01-15 -- 18");
    expect(r).toEqual({
      start: "1997-01-15",
      end: "1997-01-18",
      precision: "day",
      rawMatch: "1997-01-15 -- 18",
    });
  });

  it("extracts cross-month range YYYY-MM-DD -- MM-DD", () => {
    const r = extractDateFromSegment("2009-02-07 -- 03-14");
    expect(r).toEqual({
      start: "2009-02-07",
      end: "2009-03-14",
      precision: "day",
      rawMatch: "2009-02-07 -- 03-14",
    });
  });

  it("extracts full cross-date range YYYY-MM-DD -- YYYY-MM-DD", () => {
    const r = extractDateFromSegment("2009-02-07 -- 2009-03-01");
    expect(r).toEqual({
      start: "2009-02-07",
      end: "2009-03-01",
      precision: "day",
      rawMatch: "2009-02-07 -- 2009-03-01",
    });
  });

  it("returns null for text without dates", () => {
    expect(extractDateFromSegment("scan0006")).toBeNull();
    expect(extractDateFromSegment("Subfolder")).toBeNull();
    expect(extractDateFromSegment("Photos")).toBeNull();
  });

  it("ignores fully invalid dates", () => {
    expect(extractDateFromSegment("9999-99-99")).toBeNull();
  });

  it("falls back to year when month is invalid in YYYY-MM-DD", () => {
    const r = extractDateFromSegment("2020-13-01");
    expect(r?.start).toBe("2020");
    expect(r?.precision).toBe("year");
  });

  it("extracts year-month from folder-style 2002-08", () => {
    const r = extractDateFromSegment("2002-08");
    expect(r?.start).toBe("2002-08");
    expect(r?.precision).toBe("month");
  });

  it("handles 0000--1999 as year range", () => {
    const r = extractDateFromSegment("Photo 0000--1999");
    expect(r).toBeNull(); // 0000 is below MIN_YEAR
  });
});

describe("extractDateFromPath", () => {
  it("extracts date from filename over folder", () => {
    const r = extractDateFromPath(
      "C:\\Photos\\2002-08\\Subfolder\\2009-02-07 birthday.jpg",
    );
    expect(r?.start).toBe("2009-02-07");
    expect(r?.precision).toBe("day");
    expect(r?.source).toBe("script_filename+folder");
    expect(r?.from_folder_depth).toBe(0);
  });

  it("falls back to folder date when filename has none", () => {
    const r = extractDateFromPath(
      "C:\\Photos\\2002-08\\Subfolder\\scan0006.jpg",
    );
    expect(r?.start).toBe("2002-08");
    expect(r?.precision).toBe("month");
    expect(r?.source).toBe("script_folder");
    expect(r?.from_folder_depth).toBe(2);
  });

  it("extracts compact date from filename", () => {
    const r = extractDateFromPath(
      "C:\\Photos\\SomeFolder\\Subfolder\\20200306_185130.jpg",
    );
    expect(r?.start).toBe("2020-03-06");
    expect(r?.source).toBe("script_filename");
  });

  it("extracts date range from folder path", () => {
    const r = extractDateFromPath(
      "C:\\EMK-Media\\Photo 0000--1999\\1982--91 School 481\\scan.jpg",
    );
    expect(r?.start).toBe("1982");
    expect(r?.end).toBe("1991");
    expect(r?.precision).toBe("year");
    expect(r?.source).toBe("script_folder");
  });

  it("returns null for path with no dates", () => {
    const r = extractDateFromPath("C:\\Photos\\Vacation\\beach.jpg");
    expect(r).toBeNull();
  });

  it("extracts year-month from direct parent folder", () => {
    const r = extractDateFromPath("C:\\Photos\\1994-09\\image.jpg");
    expect(r?.start).toBe("1994-09");
    expect(r?.source).toBe("script_folder");
    expect(r?.from_folder_depth).toBe(1);
  });

  it("uses forward slashes on Unix-style paths", () => {
    const r = extractDateFromPath("/home/user/Photos/2002-08/scan.jpg");
    expect(r?.start).toBe("2002-08");
    expect(r?.source).toBe("script_folder");
  });
});

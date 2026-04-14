import { describe, it, expect } from "vitest";
import { extractDisplayTitle, isCameraPrefixOnlyFilename } from "./title-extractor";

describe("extractDisplayTitle", () => {
  it("strips trailing scan identifier", () => {
    expect(
      extractDisplayTitle(
        "1975-08 учимся ходить с мамой (6месяцев) scan0021.jpg",
      ),
    ).toBe("1975-08 учимся ходить с мамой (6месяцев)");
  });

  it("strips leading scan identifier", () => {
    expect(extractDisplayTitle("scan0021 Real title of image.jpg")).toBe(
      "Real title of image",
    );
  });

  it("strips trailing isolated digit", () => {
    expect(
      extractDisplayTitle(
        "1994-09 Группа ЛЭТИ Сентябрь 1994 Ботанический сад 1.jpg",
      ),
    ).toBe("1994-09 Группа ЛЭТИ Сентябрь 1994 Ботанический сад");
  });

  it("strips IMG_ prefix", () => {
    expect(extractDisplayTitle("IMG_20200306_185130.jpg")).toBeNull();
  });

  it("strips DSC_ prefix", () => {
    expect(extractDisplayTitle("DSC_1234.jpg")).toBeNull();
  });

  it("strips DSCN prefix", () => {
    expect(extractDisplayTitle("DSCN0042.jpg")).toBeNull();
  });

  it("returns null for pure scan file", () => {
    expect(extractDisplayTitle("scan0006.jpg")).toBeNull();
  });

  it("returns null for digit-only filename", () => {
    expect(extractDisplayTitle("12345.jpg")).toBeNull();
  });

  it("preserves meaningful titles", () => {
    expect(
      extractDisplayTitle("2009-02-07 Misha Kalinin birthday party.jpg"),
    ).toBe("2009-02-07 Misha Kalinin birthday party");
  });

  it("preserves title with parenthesized location", () => {
    expect(
      extractDisplayTitle(
        "2009 Дениска дома (Geneve, Gd Lancy, Ch Louis Burgy 2a).jpg",
      ),
    ).toBe("2009 Дениска дома (Geneve, Gd Lancy, Ch Louis Burgy 2a)");
  });

  it("handles filename without extension", () => {
    expect(extractDisplayTitle("2009-02-14 Fête de Genève")).toBe(
      "2009-02-14 Fête de Genève",
    );
  });

  it("handles 'scan' as standalone filename", () => {
    expect(extractDisplayTitle("scan")).toBeNull();
  });

  it("preserves Cyrillic text with date range", () => {
    expect(
      extractDisplayTitle(
        "1992-1998 Группа университета СПбГЭТУ (ЛЭТИ)",
      ),
    ).toBe("1992-1998 Группа университета СПбГЭТУ (ЛЭТИ)");
  });

  it("strips trailing comma and junk from complex filenames", () => {
    expect(
      extractDisplayTitle(
        "ЛТО Наташа Дикорева, Катя Бычкова, Ольга Роот,.jpg",
      ),
    ).toBe("ЛТО Наташа Дикорева, Катя Бычкова, Ольга Роот");
  });
});

describe("isCameraPrefixOnlyFilename", () => {
  it("returns true for IMG camera file", () => {
    expect(isCameraPrefixOnlyFilename("IMG_20200306_185130.jpg")).toBe(true);
  });

  it("returns true for scan file", () => {
    expect(isCameraPrefixOnlyFilename("scan0006.jpg")).toBe(true);
  });

  it("returns false for meaningful title", () => {
    expect(isCameraPrefixOnlyFilename("2009-02-07 Misha Kalinin birthday party.jpg")).toBe(false);
  });
});

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hasCachedGeocoderData,
  initGeocoder,
  isGeocoderReady,
  resetGeocoderForTests,
  reverseGeocode,
  reverseGeocodeBatch,
  type LocalReverseGeocoderModule,
} from "./reverse-geocoder";

const SAMPLE_HIT = {
  geoNameId: "2919146",
  name: "Gomaringen",
  asciiName: "Gomaringen",
  alternateNames: null,
  latitude: "48.45349",
  longitude: "9.09582",
  featureClass: "P",
  featureCode: "PPLA4",
  countryCode: "DE",
  cc2: null,
  admin1Code: {
    name: "Baden-Württemberg",
    asciiName: "Baden-Wuerttemberg",
    geoNameId: "2953481",
  },
  admin2Code: {
    name: "Tübingen",
    asciiName: "Tuebingen",
    geoNameId: "111",
  },
  admin3Code: null,
  admin4Code: null,
  population: "9000",
  elevation: "",
  dem: "400",
  timezone: "Europe/Berlin",
  modificationDate: "2023-01-01",
  distance: 3.66,
};

function createMockGeocoder(): LocalReverseGeocoderModule {
  return {
    init: vi.fn((_opts: unknown, cb: () => void) => {
      cb();
    }) as unknown as LocalReverseGeocoderModule["init"],
    lookUp: vi.fn(
      (
        _points: unknown,
        _maxResults: unknown,
        cb: (err: Error | null, results: unknown[][]) => void,
      ) => {
        cb(null, [[SAMPLE_HIT]]);
      },
    ) as unknown as LocalReverseGeocoderModule["lookUp"],
  };
}

describe("reverseGeocode", () => {
  beforeEach(() => {
    resetGeocoderForTests(() => createMockGeocoder());
  });

  it("returns a geocoded location after init", async () => {
    expect(isGeocoderReady()).toBe(false);
    await initGeocoder("/tmp/test-geonames");
    expect(isGeocoderReady()).toBe(true);

    const result = await reverseGeocode(48.466667, 9.133333);
    expect(result).not.toBeNull();
    expect(result?.countryCode).toBe("DE");
    expect(result?.countryName).toBe("Germany");
    expect(result?.admin1Name).toBe("Baden-Württemberg");
    expect(result?.admin2Name).toBe("Tübingen");
    expect(result?.cityName).toBe("Gomaringen");
    expect(result?.distance).toBe(3.66);
  });

  it("returns null when geocoder is not ready", async () => {
    const result = await reverseGeocode(48.466667, 9.133333);
    expect(result).toBeNull();
  });
});

describe("geocoder cache detection", () => {
  beforeEach(() => {
    resetGeocoderForTests(() => createMockGeocoder());
  });

  it("detects and stabilizes previously downloaded dated GeoNames files", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "emk-geocoder-"));
    const citiesDir = path.join(tmpRoot, "cities1000");
    const admin1Dir = path.join(tmpRoot, "admin1_codes");
    const admin2Dir = path.join(tmpRoot, "admin2_codes");
    fs.mkdirSync(citiesDir, { recursive: true });
    fs.mkdirSync(admin1Dir, { recursive: true });
    fs.mkdirSync(admin2Dir, { recursive: true });
    fs.writeFileSync(path.join(citiesDir, "cities1000_2026-04-24.txt"), "cities");
    fs.writeFileSync(path.join(admin1Dir, "admin1CodesASCII_2026-04-24.txt"), "admin1");
    fs.writeFileSync(path.join(admin2Dir, "admin2CodesASCII_2026-04-24.txt"), "admin2");

    expect(hasCachedGeocoderData(tmpRoot)).toBe(true);
    await initGeocoder(tmpRoot);

    expect(fs.existsSync(path.join(citiesDir, "cities1000.txt"))).toBe(true);
    expect(fs.existsSync(path.join(admin1Dir, "admin1CodesASCII.txt"))).toBe(true);
    expect(fs.existsSync(path.join(admin2Dir, "admin2CodesASCII.txt"))).toBe(true);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("clears cached GeoNames files when forcing a refresh", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "emk-geocoder-"));
    const citiesDir = path.join(tmpRoot, "cities1000");
    const admin1Dir = path.join(tmpRoot, "admin1_codes");
    const admin2Dir = path.join(tmpRoot, "admin2_codes");
    fs.mkdirSync(citiesDir, { recursive: true });
    fs.mkdirSync(admin1Dir, { recursive: true });
    fs.mkdirSync(admin2Dir, { recursive: true });
    fs.writeFileSync(path.join(citiesDir, "cities1000.txt"), "cities");
    fs.writeFileSync(path.join(admin1Dir, "admin1CodesASCII.txt"), "admin1");
    fs.writeFileSync(path.join(admin2Dir, "admin2CodesASCII.txt"), "admin2");

    await initGeocoder(tmpRoot, { forceRefresh: true });

    expect(fs.existsSync(path.join(citiesDir, "cities1000.txt"))).toBe(false);
    expect(fs.existsSync(path.join(admin1Dir, "admin1CodesASCII.txt"))).toBe(false);
    expect(fs.existsSync(path.join(admin2Dir, "admin2CodesASCII.txt"))).toBe(false);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });
});

describe("reverseGeocodeBatch", () => {
  beforeEach(() => {
    resetGeocoderForTests(() => createMockGeocoder());
  });

  it("returns results for each point", async () => {
    await initGeocoder("/tmp/test-geonames");

    const results = await reverseGeocodeBatch([
      { latitude: 48.466667, longitude: 9.133333 },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]?.countryCode).toBe("DE");
    expect(results[0]?.admin2Name).toBe("Tübingen");
  });

  it("returns empty array for empty input", async () => {
    const results = await reverseGeocodeBatch([]);
    expect(results).toHaveLength(0);
  });
});

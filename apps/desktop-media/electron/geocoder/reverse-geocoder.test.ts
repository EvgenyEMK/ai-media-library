import { describe, it, expect, vi, beforeEach } from "vitest";
import {
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
  admin2Code: null,
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
    await initGeocoder("/tmp/test-user-data");
    expect(isGeocoderReady()).toBe(true);

    const result = await reverseGeocode(48.466667, 9.133333);
    expect(result).not.toBeNull();
    expect(result?.countryCode).toBe("DE");
    expect(result?.countryName).toBe("Germany");
    expect(result?.admin1Name).toBe("Baden-Württemberg");
    expect(result?.cityName).toBe("Gomaringen");
    expect(result?.distance).toBe(3.66);
  });

  it("returns null when geocoder is not ready", async () => {
    const result = await reverseGeocode(48.466667, 9.133333);
    expect(result).toBeNull();
  });
});

describe("reverseGeocodeBatch", () => {
  beforeEach(() => {
    resetGeocoderForTests(() => createMockGeocoder());
  });

  it("returns results for each point", async () => {
    await initGeocoder("/tmp/test-user-data");

    const results = await reverseGeocodeBatch([
      { latitude: 48.466667, longitude: 9.133333 },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]?.countryCode).toBe("DE");
  });

  it("returns empty array for empty input", async () => {
    const results = await reverseGeocodeBatch([]);
    expect(results).toHaveLength(0);
  });
});

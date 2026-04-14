import { describe, it, expect } from "vitest";
import { isoCountryName, ISO_COUNTRY_NAMES } from "./country-codes";

describe("isoCountryName", () => {
  it("returns country name for a known code", () => {
    expect(isoCountryName("US")).toBe("United States");
    expect(isoCountryName("DE")).toBe("Germany");
    expect(isoCountryName("JP")).toBe("Japan");
  });

  it("is case-insensitive", () => {
    expect(isoCountryName("us")).toBe("United States");
    expect(isoCountryName("de")).toBe("Germany");
    expect(isoCountryName("Gb")).toBe("United Kingdom");
  });

  it("returns the code itself for unknown codes", () => {
    expect(isoCountryName("XX")).toBe("XX");
    expect(isoCountryName("ZZ")).toBe("ZZ");
  });

  it("has entries for all major countries", () => {
    const majorCodes = ["US", "GB", "DE", "FR", "JP", "CN", "IN", "BR", "AU", "CA", "RU", "IT", "ES"];
    for (const code of majorCodes) {
      expect(ISO_COUNTRY_NAMES[code]).toBeDefined();
    }
  });

  it("uses common short names", () => {
    expect(isoCountryName("RU")).toBe("Russia");
    expect(isoCountryName("KR")).toBe("South Korea");
    expect(isoCountryName("TW")).toBe("Taiwan");
    expect(isoCountryName("IR")).toBe("Iran");
  });
});

import { describe, expect, it } from "vitest";
import { DEFAULT_SMART_ALBUM_SETTINGS, type SmartAlbumSettings } from "../../shared/ipc";
import { smartAlbumSettingsToFilters } from "./useSmartAlbums";

describe("smartAlbumSettingsToFilters", () => {
  it("maps default settings to star and AI aesthetic filters", () => {
    expect(smartAlbumSettingsToFilters(DEFAULT_SMART_ALBUM_SETTINGS)).toEqual({
      includeUnconfirmedFaces: true,
      starRatingMin: 3,
      starRatingOperator: "gte",
      aiAestheticMin: 7,
      aiAestheticOperator: "gte",
      ratingLogic: "or",
    });
  });

  it("omits star filter when defaultStarRating is null", () => {
    const settings: SmartAlbumSettings = {
      ...DEFAULT_SMART_ALBUM_SETTINGS,
      defaultStarRating: null,
    };
    expect(smartAlbumSettingsToFilters(settings).starRatingMin).toBeUndefined();
    expect(smartAlbumSettingsToFilters(settings).starRatingOperator).toBe("gte");
  });

  it("maps AI star presets to aesthetic min (1→1, 4→7, 5→9, 6→10 cap)", () => {
    const base = { ...DEFAULT_SMART_ALBUM_SETTINGS, defaultStarRating: null };
    expect(smartAlbumSettingsToFilters({ ...base, defaultAiRating: 1 }).aiAestheticMin).toBe(1);
    expect(smartAlbumSettingsToFilters({ ...base, defaultAiRating: 4 }).aiAestheticMin).toBe(7);
    expect(smartAlbumSettingsToFilters({ ...base, defaultAiRating: 5 }).aiAestheticMin).toBe(9);
    expect(smartAlbumSettingsToFilters({ ...base, defaultAiRating: 6 }).aiAestheticMin).toBe(10);
  });

  it("omits aesthetic min when defaultAiRating is null or zero", () => {
    const base = { ...DEFAULT_SMART_ALBUM_SETTINGS, defaultStarRating: null };
    expect(smartAlbumSettingsToFilters({ ...base, defaultAiRating: null }).aiAestheticMin).toBeUndefined();
    expect(smartAlbumSettingsToFilters({ ...base, defaultAiRating: 0 }).aiAestheticMin).toBeUndefined();
  });

  it("passes through rating operators from settings", () => {
    const settings: SmartAlbumSettings = {
      ...DEFAULT_SMART_ALBUM_SETTINGS,
      defaultStarRatingOperator: "eq",
      defaultAiRatingOperator: "eq",
    };
    const f = smartAlbumSettingsToFilters(settings);
    expect(f.starRatingOperator).toBe("eq");
    expect(f.aiAestheticOperator).toBe("eq");
  });
});

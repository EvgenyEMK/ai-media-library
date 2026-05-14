import { describe, expect, it } from "vitest";
import {
  buildGuidedSlideDeckFromIds,
  GUIDED_SLIDE_IDS,
  PEOPLE_FACES_HELP_SLIDE_ORDER,
  PRODUCT_WELCOME_SLIDE_ORDER,
} from "./guided-slide-catalog";

describe("guided-slide-catalog", () => {
  it("builds people help deck with flow-only slide after shared core", () => {
    const deck = buildGuidedSlideDeckFromIds(
      PEOPLE_FACES_HELP_SLIDE_ORDER,
      "people-faces-help",
      "People",
      "feature-help",
    );
    expect(deck.deckCategory).toBe("feature-help");
    expect(deck.slides.map((s) => s.id)).toEqual([GUIDED_SLIDE_IDS.peopleFacesCore, GUIDED_SLIDE_IDS.peopleFacesDeep]);
  });

  it("product welcome flow orders people before search", () => {
    const peopleIdx = PRODUCT_WELCOME_SLIDE_ORDER.indexOf(GUIDED_SLIDE_IDS.peopleFacesCore);
    const searchIdx = PRODUCT_WELCOME_SLIDE_ORDER.indexOf(GUIDED_SLIDE_IDS.searchPlainLanguage);
    expect(peopleIdx).toBeGreaterThan(-1);
    expect(searchIdx).toBeGreaterThan(-1);
    expect(peopleIdx).toBeLessThan(searchIdx);
  });
});

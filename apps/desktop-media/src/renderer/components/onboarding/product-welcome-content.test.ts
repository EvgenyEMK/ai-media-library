import { describe, expect, it } from "vitest";
import {
  buildProductWelcomeDeck,
  productWelcomeSlideCount,
  PRODUCT_WELCOME_FLOW_TITLE,
} from "./product-welcome-content";

describe("buildProductWelcomeDeck", () => {
  it("tags deck as product intro and stable flow title", () => {
    const deck = buildProductWelcomeDeck("a");
    expect(deck.flowTitle).toBe(PRODUCT_WELCOME_FLOW_TITLE);
    expect(deck.deckCategory).toBe("product-intro");
  });

  it("variant a uses catalog slide ids", () => {
    const ids = buildProductWelcomeDeck("a").slides.map((s) => s.id);
    expect(ids[0]).toBe("welcome-features");
    expect(ids).toContain("people-faces-core");
  });

  it("variant sizes differ for comparison", () => {
    expect(productWelcomeSlideCount("a")).toBe(10);
    expect(productWelcomeSlideCount("b")).toBe(4);
    expect(productWelcomeSlideCount("c")).toBe(9);
  });
});

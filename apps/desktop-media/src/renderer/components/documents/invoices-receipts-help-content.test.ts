import { describe, expect, it } from "vitest";
import {
  buildInvoicesReceiptsHelpDeck,
  invoicesReceiptsHelpSlideCount,
} from "./invoices-receipts-help-content";

describe("buildInvoicesReceiptsHelpDeck", () => {
  it("uses a stable flow title for orientation", () => {
    expect(buildInvoicesReceiptsHelpDeck("a", "qwen2.5vl:3b").flowTitle).toBe("Invoices & Receipts");
  });

  it("variant a has three slides with Ollama slide last", () => {
    const deck = buildInvoicesReceiptsHelpDeck("a", "m1");
    expect(deck.slides).toHaveLength(3);
    expect(deck.slides[2]?.slideHeadline).toBe("Image analysis - AI model");
    expect(deck.slides[2]?.blocks.some((b) => b.body.includes("m1"))).toBe(true);
  });

  it("variant a middle slide is quick search and consistency", () => {
    expect(buildInvoicesReceiptsHelpDeck("a", "x").slides[1]?.slideHeadline).toBe(
      "Quick search and data consistency check",
    );
  });

  it("variant b has three slides", () => {
    expect(buildInvoicesReceiptsHelpDeck("b", "x").slides).toHaveLength(3);
  });

  it("variant c has five slides", () => {
    expect(buildInvoicesReceiptsHelpDeck("c", "x").slides).toHaveLength(5);
  });

  it("slide counts match helper", () => {
    expect(invoicesReceiptsHelpSlideCount("a")).toBe(3);
    expect(invoicesReceiptsHelpSlideCount("b")).toBe(3);
    expect(invoicesReceiptsHelpSlideCount("c")).toBe(5);
  });
});

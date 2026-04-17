import { describe, expect, it } from "vitest";
import { photoPendingTintToBorderClass, photoPendingTintToSquareClass } from "./photo-pending-folder-tint";

describe("photoPendingTintToSquareClass (sidebar folder icon tint)", () => {
  it("maps red / amber / green to Tailwind classes (photo-analysis-waiting rollup)", () => {
    expect(photoPendingTintToSquareClass("red")).toBe("text-red-400");
    expect(photoPendingTintToSquareClass("amber")).toBe("text-amber-400");
    expect(photoPendingTintToSquareClass("green")).toBe("text-[hsl(var(--success))]");
  });
});

describe("photoPendingTintToBorderClass (image analysis mini-card when face+search done)", () => {
  it("maps settings tint to mini-card border classes", () => {
    expect(photoPendingTintToBorderClass("red")).toBe("border-destructive");
    expect(photoPendingTintToBorderClass("amber")).toBe("border-amber-400");
    expect(photoPendingTintToBorderClass("green")).toBe("border-[hsl(var(--success))]");
  });
});

import { describe, expect, it } from "vitest";
import { viewerStyles } from "./viewer-styles";

describe("viewer thumb active styles", () => {
  it("defines active thumb slide styles for selection indication", () => {
    expect(viewerStyles.thumbSlideActive).toBeDefined();
    expect(viewerStyles.thumbSlideActive?.boxShadow).toBeTruthy();
  });
});

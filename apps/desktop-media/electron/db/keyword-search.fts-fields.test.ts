import { describe, expect, it } from "vitest";
import { getFtsFieldsFromAiMetadata } from "./keyword-search";

describe("getFtsFieldsFromAiMetadata", () => {
  it("prefers embedded title over AI title", () => {
    const fields = getFtsFieldsFromAiMetadata(
      {
        schema_version: "2.0",
        file_data: { exif_xmp: { title: "XMP Title", description: null, location_text: null } },
        image_analysis: { title: "AI Title", description: "AI Desc" },
      },
      null,
    );
    expect(fields.title).toBe("XMP Title");
    expect(fields.description).toBe("AI Desc");
  });

  it("uses location_name then embedded location_text", () => {
    const fields = getFtsFieldsFromAiMetadata(
      {
        schema_version: "2.0",
        file_data: { exif_xmp: { location_text: "Paris" } },
        image_analysis: {},
      },
      "Berlin",
    );
    expect(fields.location).toBe("Berlin");
    const fields2 = getFtsFieldsFromAiMetadata(
      { schema_version: "2.0", file_data: { exif_xmp: { location_text: "Paris" } }, image_analysis: {} },
      "",
    );
    expect(fields2.location).toBe("Paris");
  });

  it("includes FTS rating tokens from embedded.star_rating", () => {
    const fields = getFtsFieldsFromAiMetadata(
      {
        schema_version: "2.0",
        file_data: { exif_xmp: { star_rating: 5 } },
        image_analysis: {},
      },
      null,
    );
    expect(fields.ratingTokens).toBe("file_rating_5");
    const rej = getFtsFieldsFromAiMetadata(
      { schema_version: "2.0", file_data: { exif_xmp: { star_rating: -1 } }, image_analysis: {} },
      null,
    );
    expect(rej.ratingTokens).toBe("file_rating_rejected");
  });
});

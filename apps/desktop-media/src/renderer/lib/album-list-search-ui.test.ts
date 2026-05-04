import { describe, expect, it } from "vitest";
import { ALBUM_LIST_SEARCH_FIELD_DEBOUNCE_MS } from "./album-list-search-ui";

describe("album-list-search-ui", () => {
  it("debounces typed album list fields at 2× the 300ms baseline (person tags stay immediate)", () => {
    expect(ALBUM_LIST_SEARCH_FIELD_DEBOUNCE_MS).toBe(600);
  });
});

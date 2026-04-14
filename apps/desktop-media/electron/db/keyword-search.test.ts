import { describe, it, expect, vi } from "vitest";
import { buildFtsQuery } from "./keyword-search";

vi.mock("./client", () => ({
  getDesktopDatabase: () => ({}),
}));

vi.mock("./folder-analysis-status", () => ({
  DEFAULT_LIBRARY_ID: "test-lib",
}));

describe("buildFtsQuery", () => {
  it("returns null for empty string", () => {
    expect(buildFtsQuery("")).toBeNull();
  });

  it("returns null for whitespace-only input", () => {
    expect(buildFtsQuery("   ")).toBeNull();
  });

  it("passes through simple words", () => {
    expect(buildFtsQuery("lady piano")).toBe("lady piano");
  });

  it("strips special FTS5 characters", () => {
    expect(buildFtsQuery('"white dress"')).toBe("white dress");
    expect(buildFtsQuery("test*")).toBe("test");
    expect(buildFtsQuery("(hello)")).toBe("hello");
  });

  it("collapses multiple spaces", () => {
    expect(buildFtsQuery("  lady   in   white  ")).toBe("lady in white");
  });

  it("handles mixed special characters and words", () => {
    expect(buildFtsQuery('lady "white dress" near [piano]')).toBe(
      "lady white dress near piano",
    );
  });
});

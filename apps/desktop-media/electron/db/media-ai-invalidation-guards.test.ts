import { describe, expect, it } from "vitest";
import {
  shouldInvalidateAiAfterCatalogUpdate,
  shouldInvalidateAiAfterCatalogUpdateForTrustedUpsert,
  type MediaItemCatalogNextSnapshot,
  type MediaItemCatalogPriorSnapshot,
} from "./media-ai-invalidation-guards";

const basePrior: MediaItemCatalogPriorSnapshot = {
  content_hash: "abc",
  width: 1000,
  height: 800,
  orientation: 1,
  byte_size: 500_000,
  file_mtime_ms: 1_700_000_000_000,
};

const sameNext = (overrides: Partial<MediaItemCatalogNextSnapshot> = {}): MediaItemCatalogNextSnapshot => ({
  content_hash: basePrior.content_hash,
  width: basePrior.width,
  height: basePrior.height,
  orientation: basePrior.orientation,
  byte_size: basePrior.byte_size,
  file_mtime_ms: basePrior.file_mtime_ms,
  ...overrides,
});

describe("shouldInvalidateAiAfterCatalogUpdate", () => {
  it("returns false when hash and geometry and size/mtime unchanged", () => {
    expect(
      shouldInvalidateAiAfterCatalogUpdate({
        prior: basePrior,
        next: sameNext(),
      }),
    ).toBe(false);
  });

  it("returns false when only embedded-style metadata would differ (simulated: same next snapshot)", () => {
    expect(
      shouldInvalidateAiAfterCatalogUpdate({
        prior: basePrior,
        next: sameNext({}),
      }),
    ).toBe(false);
  });

  it("returns false when only content_hash changes but geometry unchanged (XMP/rating rewrite)", () => {
    expect(
      shouldInvalidateAiAfterCatalogUpdate({
        prior: basePrior,
        next: sameNext({ content_hash: "def", byte_size: 500_400 }),
      }),
    ).toBe(false);
  });

  it("returns true when content_hash changes and width changes", () => {
    expect(
      shouldInvalidateAiAfterCatalogUpdate({
        prior: basePrior,
        next: sameNext({ content_hash: "def", width: 1200 }),
      }),
    ).toBe(true);
  });

  it("returns false when hash appears for the first time (null → value)", () => {
    expect(
      shouldInvalidateAiAfterCatalogUpdate({
        prior: { ...basePrior, content_hash: null },
        next: sameNext({ content_hash: "newhash" }),
      }),
    ).toBe(false);
  });

  it("returns true when width changes with same hash", () => {
    expect(
      shouldInvalidateAiAfterCatalogUpdate({
        prior: basePrior,
        next: sameNext({ width: 1200 }),
      }),
    ).toBe(true);
  });

  it("returns true when orientation changes", () => {
    expect(
      shouldInvalidateAiAfterCatalogUpdate({
        prior: basePrior,
        next: sameNext({ orientation: 6 }),
      }),
    ).toBe(true);
  });

  it("returns true when both hashes null and mtime changes", () => {
    expect(
      shouldInvalidateAiAfterCatalogUpdate({
        prior: { ...basePrior, content_hash: null },
        next: sameNext({ content_hash: null, file_mtime_ms: 1_800_000_000_000 }),
      }),
    ).toBe(true);
  });

  it("returns false when both hashes null and size/mtime unchanged", () => {
    expect(
      shouldInvalidateAiAfterCatalogUpdate({
        prior: { ...basePrior, content_hash: null },
        next: sameNext({ content_hash: null }),
      }),
    ).toBe(false);
  });
});

describe("shouldInvalidateAiAfterCatalogUpdateForTrustedUpsert", () => {
  it("matches base when trusted flag is off", () => {
    const prior: MediaItemCatalogPriorSnapshot = { ...basePrior, content_hash: null };
    const next = sameNext({ content_hash: null, file_mtime_ms: 1_800_000_000_000 });
    expect(
      shouldInvalidateAiAfterCatalogUpdateForTrustedUpsert({
        prior,
        next,
        trustedEmbeddedMetadataWrite: false,
      }),
    ).toBe(true);
    expect(
      shouldInvalidateAiAfterCatalogUpdateForTrustedUpsert({
        prior,
        next,
      }),
    ).toBe(true);
  });

  it("skips invalidation for both-null hash + mtime change when geometry unchanged and trusted", () => {
    const prior: MediaItemCatalogPriorSnapshot = { ...basePrior, content_hash: null };
    const next = sameNext({ content_hash: null, file_mtime_ms: 1_800_000_000_000 });
    expect(
      shouldInvalidateAiAfterCatalogUpdateForTrustedUpsert({
        prior,
        next,
        trustedEmbeddedMetadataWrite: true,
      }),
    ).toBe(false);
  });

  it("still invalidates when width changes even if trusted (real file / decode change)", () => {
    expect(
      shouldInvalidateAiAfterCatalogUpdateForTrustedUpsert({
        prior: basePrior,
        next: sameNext({ width: 2000 }),
        trustedEmbeddedMetadataWrite: true,
      }),
    ).toBe(true);
  });

  it("still invalidates when orientation changes even if trusted", () => {
    expect(
      shouldInvalidateAiAfterCatalogUpdateForTrustedUpsert({
        prior: basePrior,
        next: sameNext({ orientation: 6 }),
        trustedEmbeddedMetadataWrite: true,
      }),
    ).toBe(true);
  });

  it("returns false for metadata-only hash change without trusted (base guard)", () => {
    expect(
      shouldInvalidateAiAfterCatalogUpdateForTrustedUpsert({
        prior: basePrior,
        next: sameNext({ content_hash: "def", byte_size: 500_400 }),
        trustedEmbeddedMetadataWrite: false,
      }),
    ).toBe(false);
  });
});

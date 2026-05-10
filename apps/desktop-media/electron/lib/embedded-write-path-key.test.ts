import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalPathKeyForEmbeddedWriteQueue } from "./embedded-write-path-key";

describe("canonicalPathKeyForEmbeddedWriteQueue", () => {
  it("matches for repeated calls on an existing file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "emk-path-key-"));
    try {
      const file = path.join(dir, "a.jpg");
      fs.writeFileSync(file, Buffer.from([0]));
      const k1 = canonicalPathKeyForEmbeddedWriteQueue(file);
      const k2 = canonicalPathKeyForEmbeddedWriteQueue(file);
      expect(k1).toBe(k2);
      expect(k1.length).toBeGreaterThan(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to normalize when the path does not exist", () => {
    const bogus = path.join(os.tmpdir(), "emk-no-such-file-", `${Date.now()}.jpg`);
    expect(canonicalPathKeyForEmbeddedWriteQueue(bogus)).toBe(path.normalize(bogus));
  });
});

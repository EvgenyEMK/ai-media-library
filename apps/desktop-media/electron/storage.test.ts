import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readSettings, writeSettings } from "./storage";
import { DEFAULT_APP_SETTINGS, DEFAULT_FACE_DETECTION_SETTINGS } from "../src/shared/ipc";

let userDataPath: string;

beforeEach(async () => {
  userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), "emk-storage-test-"));
});

afterEach(async () => {
  await fs.rm(userDataPath, { recursive: true, force: true }).catch(() => undefined);
});

describe("readSettings (no auto-writeback)", () => {
  it("returns sanitized defaults when file is missing without writing back to disk", async () => {
    const before = await fs.readdir(userDataPath);
    expect(before.includes("media-settings.json")).toBe(false);

    const settings = await readSettings(userDataPath);

    const after = await fs.readdir(userDataPath);
    expect(after.includes("media-settings.json")).toBe(false);
    expect(settings.folderScanning.writeEmbeddedMetadataOnUserEdit).toBe(false);
    expect(typeof settings.clientId).toBe("string");
    expect(settings.clientId.length).toBeGreaterThan(0);
    expect(settings.guidedExperience.helpTopics).toEqual({});
  });

  it("preserves user-set values across reads (does not race-overwrite)", async () => {
    await writeSettings(userDataPath, {
      ...DEFAULT_APP_SETTINGS,
      clientId: "test-client-id",
      folderScanning: {
        ...DEFAULT_APP_SETTINGS.folderScanning,
        writeEmbeddedMetadataOnUserEdit: true,
      },
    });

    const a = await readSettings(userDataPath);
    const b = await readSettings(userDataPath);

    expect(a.folderScanning.writeEmbeddedMetadataOnUserEdit).toBe(true);
    expect(b.folderScanning.writeEmbeddedMetadataOnUserEdit).toBe(true);
    expect(a.clientId).toBe("test-client-id");
    expect(b.clientId).toBe("test-client-id");
  });

  it("sanitizes guidedExperience helpTopics (drops unknown ids) and round-trips valid topics", async () => {
    const settingsPath = path.join(userDataPath, "media-settings.json");
    await fs.mkdir(userDataPath, { recursive: true });
    await fs.writeFile(
      settingsPath,
      JSON.stringify({
        ...DEFAULT_APP_SETTINGS,
        clientId: "guided-client",
        guidedExperience: {
          helpTopics: {
            "documents:invoices-receipts": {
              helpWizardDismissed: true,
              dismissedAt: "2026-01-01T00:00:00.000Z",
            },
            "bogus:topic": { helpWizardDismissed: true },
          },
        },
      }),
      "utf-8",
    );

    const read = await readSettings(userDataPath);
    expect(Object.keys(read.guidedExperience.helpTopics)).toEqual(["documents:invoices-receipts"]);
    expect(read.guidedExperience.helpTopics["documents:invoices-receipts"]?.helpWizardDismissed).toBe(true);
    expect(read.guidedExperience.helpTopics["documents:invoices-receipts"]?.dismissedAt).toBe(
      "2026-01-01T00:00:00.000Z",
    );

    await writeSettings(userDataPath, read);
    const read2 = await readSettings(userDataPath);
    expect(read2.guidedExperience.helpTopics["documents:invoices-receipts"]?.helpWizardDismissed).toBe(true);
  });
});

describe("writeSettings (atomic via tmpfile + rename)", () => {
  it("never leaves an empty/partial settings file visible to concurrent readers", async () => {
    const settingsWithEmbedTrue = {
      ...DEFAULT_APP_SETTINGS,
      clientId: "atomic-client",
      folderScanning: {
        ...DEFAULT_APP_SETTINGS.folderScanning,
        writeEmbeddedMetadataOnUserEdit: true,
      },
    };
    await writeSettings(userDataPath, settingsWithEmbedTrue);

    let observedFalse = false;
    const reader = (async () => {
      // 80 reads × ~1ms each interleaves heavily with the rapid rewrites below.
      for (let i = 0; i < 80; i += 1) {
        const s = await readSettings(userDataPath);
        if (s.folderScanning.writeEmbeddedMetadataOnUserEdit !== true) {
          observedFalse = true;
        }
        await new Promise((r) => setTimeout(r, 0));
      }
    })();

    const writer = (async () => {
      for (let i = 0; i < 40; i += 1) {
        await writeSettings(userDataPath, settingsWithEmbedTrue);
      }
    })();

    await Promise.all([reader, writer]);
    expect(observedFalse).toBe(false);
  });

  it("never returns a partial/empty file even under interleaved writes/reads of different values", async () => {
    // Alternate between two distinct, valid snapshots; readers must always observe one of them
    // (never the sanitized defaults that would result from parsing an empty/half-written file).
    const snapshotA = {
      ...DEFAULT_APP_SETTINGS,
      clientId: "client-a",
      folderScanning: {
        ...DEFAULT_APP_SETTINGS.folderScanning,
        writeEmbeddedMetadataOnUserEdit: true,
      },
    };
    const snapshotB = {
      ...DEFAULT_APP_SETTINGS,
      clientId: "client-b",
      folderScanning: {
        ...DEFAULT_APP_SETTINGS.folderScanning,
        writeEmbeddedMetadataOnUserEdit: true,
      },
    };
    await writeSettings(userDataPath, snapshotA);

    const writer = (async () => {
      for (let i = 0; i < 30; i += 1) {
        await writeSettings(userDataPath, i % 2 === 0 ? snapshotB : snapshotA);
      }
    })();
    const reader = (async () => {
      for (let i = 0; i < 60; i += 1) {
        const s = await readSettings(userDataPath);
        // writeEmbedded is set on both snapshots; partial-file fallback would expose `false`.
        expect(s.folderScanning.writeEmbeddedMetadataOnUserEdit).toBe(true);
        expect(s.clientId === "client-a" || s.clientId === "client-b").toBe(true);
      }
    })();
    await Promise.all([writer, reader]);
  });
});

describe("readSettings face landmark refinement", () => {
  it("forces faceLandmarkRefinement.enabled to true even when the file had it disabled", async () => {
    const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), "emk-storage-face-lm-"));
    try {
      const settingsPath = path.join(userDataPath, "media-settings.json");
      await fs.mkdir(userDataPath, { recursive: true });
      await fs.writeFile(
        settingsPath,
        JSON.stringify({
          ...DEFAULT_APP_SETTINGS,
          clientId: "test-client-face-lm",
          faceDetection: {
            ...DEFAULT_FACE_DETECTION_SETTINGS,
            faceLandmarkRefinement: {
              ...DEFAULT_FACE_DETECTION_SETTINGS.faceLandmarkRefinement,
              enabled: false,
            },
          },
        }),
        "utf-8",
      );

      const read = await readSettings(userDataPath);
      expect(read.faceDetection.faceLandmarkRefinement.enabled).toBe(true);
      expect(read.faceDetection.faceLandmarkRefinement.model).toBe(
        DEFAULT_FACE_DETECTION_SETTINGS.faceLandmarkRefinement.model,
      );
    } finally {
      await fs.rm(userDataPath, { recursive: true, force: true }).catch(() => undefined);
    }
  });
});

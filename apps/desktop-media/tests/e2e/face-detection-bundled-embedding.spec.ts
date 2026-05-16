import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect } from "./fixtures/app-fixture";
import { clickSidebarLibraryRoot } from "./fixtures/desktop-sidebar";
import { mockFolderDialog } from "./fixtures/mock-dialog";

const defaultAssetsDir = path.resolve(__dirname, "../../test-assets/e2e-photos");
const configuredAssetsDir = process.env.EMK_E2E_PHOTOS_DIR?.trim();
const e2ePhotosSourceDir =
  configuredAssetsDir && configuredAssetsDir.length > 0 ? configuredAssetsDir : defaultAssetsDir;

const FACE_SAMPLE = "face-detect-sample-01.jpg";

/** Single-image folder so face-detection completes quickly but still runs detect + embed for found faces. */
function createSingleFaceImageLibraryDir(): string {
  const sourceFile = path.join(e2ePhotosSourceDir, FACE_SAMPLE);
  if (!fs.existsSync(sourceFile)) {
    throw new Error(`Missing E2E face fixture: ${sourceFile}`);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "emk-e2e-face-bundle-"));
  fs.copyFileSync(sourceFile, path.join(dir, FACE_SAMPLE));
  return dir;
}

test.describe("Face detection pipeline bundles embeddings (per image)", () => {
  test.setTimeout(600_000);

  test("folder face run uses one face-detection job and leaves face embeddings ready", async ({
    electronApp,
    mainWindow,
  }) => {
    test.skip(!fs.existsSync(path.join(e2ePhotosSourceDir, FACE_SAMPLE)), `Missing ${FACE_SAMPLE} under ${e2ePhotosSourceDir}`);

    const libraryDir = createSingleFaceImageLibraryDir();
    try {
      await mainWindow.evaluate(() => {
        // @ts-expect-error E2E helpers
        window.__e2eFaceBundleUnsub?.();
        // @ts-expect-error E2E helpers
        window.__e2eFaceBundleUnsub = undefined;
        // @ts-expect-error E2E helpers
        window.__e2eFaceBundleTargetId = null as string | null;
        // @ts-expect-error E2E helpers
        window.__e2eFaceBundleJobPipelineIds = [] as string[];
        // @ts-expect-error E2E helpers
        window.__e2eFaceBundleUnsub = window.desktopApi.pipelines.onLifecycle((evt) => {
          if (evt.type === "bundle-queued") {
            // @ts-expect-error E2E helpers
            if (!window.__e2eFaceBundleTargetId) {
              // @ts-expect-error E2E helpers
              window.__e2eFaceBundleTargetId = evt.bundleId;
            }
          }
          if (evt.type !== "job-started") {
            return;
          }
          // @ts-expect-error E2E helpers
          const target = window.__e2eFaceBundleTargetId as string | null;
          if (target !== null && evt.bundleId === target) {
            // @ts-expect-error E2E helpers
            window.__e2eFaceBundleJobPipelineIds.push(evt.pipelineId);
          }
        });
      });

      const ensured = await mainWindow.evaluate(async () => {
        const settings = await window.desktopApi.getSettings();
        const model = settings.faceDetection.detectorModel;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const r = await window.desktopApi.ensureDetectorModel(model);
          if (r.success) {
            return { ok: true as const, model };
          }
          if (attempt === 2) {
            return { ok: false as const, error: r.error ?? "ensureDetectorModel failed" };
          }
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 1500 * (attempt + 1));
          });
        }
        return { ok: false as const, error: "unreachable" };
      });
      if (!ensured.ok) {
        throw new Error(`ensureDetectorModel: ${ensured.error}`);
      }

      await mockFolderDialog(electronApp, libraryDir);
      await mainWindow.getByRole("button", { name: "Add library folder" }).click();
      await clickSidebarLibraryRoot(mainWindow, libraryDir);

      await mainWindow.getByRole("button", { name: "More actions" }).click();
      await mainWindow.locator(".desktop-actions-menu").getByTitle("Start face detection").click();

      await expect
        .poll(async () =>
          mainWindow.evaluate(() => {
            // @ts-expect-error E2E helpers
            const log: string[] = window.__e2eFaceBundleJobPipelineIds ?? [];
            return log.slice();
          }),
        )
        .toContain("face-detection");

      await expect
        .poll(async () =>
          mainWindow.evaluate(async () => {
            // @ts-expect-error E2E helpers
            const target = window.__e2eFaceBundleTargetId as string | null;
            if (!target) {
              return false;
            }
            const snap = await window.desktopApi.pipelines.getSnapshot();
            const inRecent = snap.recent.some((b) => b.bundleId === target && b.state === "succeeded");
            const idle = snap.running.length === 0 && snap.queued.length === 0;
            return inRecent && idle;
          }),
        )
        .toBe(true);

      const jobPipelineIds = (await mainWindow.evaluate(() => {
        // @ts-expect-error E2E helpers
        return [...(window.__e2eFaceBundleJobPipelineIds as string[])];
      })) as string[];

      expect(jobPipelineIds.length).toBeGreaterThan(0);
      expect(new Set(jobPipelineIds)).toEqual(new Set(["face-detection"]));
      expect(jobPipelineIds.some((id) => id === "face-embedding")).toBe(false);

      const imagePath = path.normalize(path.join(libraryDir, FACE_SAMPLE));

      const faceCheck = await mainWindow.evaluate(async (lookupPath: string) => {
        const byPath = await window.desktopApi.getMediaItemsByPaths([lookupPath]);
        let item = byPath[lookupPath];
        if (!item) {
          const values = Object.values(byPath);
          if (values.length === 1) {
            item = values[0]!;
          }
        }
        if (!item) {
          return { ok: false as const, reason: "no media item" };
        }
        const instances = await window.desktopApi.listFaceInstancesForMediaItem(item.id);
        if (instances.length === 0) {
          return { ok: false as const, reason: "no face instances" };
        }
        const statuses = instances.map((f) => f.embedding_status);
        const allReady = statuses.every((s) => s === "ready");
        if (!allReady) {
          return { ok: false as const, reason: "embedding not ready", statuses, faceCount: instances.length };
        }
        return { ok: true as const, faceCount: instances.length };
      }, imagePath);

      expect(faceCheck.ok, JSON.stringify(faceCheck)).toBe(true);
    } finally {
      await mainWindow.evaluate(() => {
        // @ts-expect-error E2E helpers
        window.__e2eFaceBundleUnsub?.();
        // @ts-expect-error E2E helpers
        window.__e2eFaceBundleUnsub = undefined;
      });
      fs.rmSync(libraryDir, { recursive: true, force: true });
    }
  });
});

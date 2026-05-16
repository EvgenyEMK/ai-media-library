import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect } from "./fixtures/app-fixture";
import { clickSidebarLibraryRoot } from "./fixtures/desktop-sidebar";
import { mockFolderDialog } from "./fixtures/mock-dialog";
import { waitForArcFaceModelReady, waitForSemanticSearchAiReady } from "./fixtures/e2e-ai-ready";
import { waitForSemanticIndexIdle } from "./fixtures/semantic-index-wait";

const defaultAssetsDir = path.resolve(__dirname, "../../test-assets-local/e2e-photos");
const configuredAssetsDir = process.env.EMK_E2E_PHOTOS_DIR?.trim();
const e2ePhotosSourceDir =
  configuredAssetsDir && configuredAssetsDir.length > 0 ? configuredAssetsDir : defaultAssetsDir;

const expectationsPath = path.join(defaultAssetsDir, "expectations.json");

interface PersonDiscoveryExpectations {
  personLabel: string;
  confirmedImage: string;
  unconfirmedImage: string;
  searchPrompt: string;
  requiredFiles: string[];
}

function loadExpectations(): PersonDiscoveryExpectations | null {
  if (!fs.existsSync(expectationsPath)) {
    return null;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(expectationsPath, "utf-8")) as {
      unconfirmedFaceSearch?: PersonDiscoveryExpectations;
    };
    return raw.unconfirmedFaceSearch ?? null;
  } catch {
    return null;
  }
}

function createTwoFaceLibraryDir(exp: PersonDiscoveryExpectations): string {
  for (const name of exp.requiredFiles) {
    const source = path.join(e2ePhotosSourceDir, name);
    if (!fs.existsSync(source)) {
      throw new Error(`Missing E2E face fixture: ${source}`);
    }
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "emk-e2e-face-pipeline-person-"));
  for (const name of exp.requiredFiles) {
    fs.copyFileSync(path.join(e2ePhotosSourceDir, name), path.join(dir, name));
  }
  return dir;
}

test.describe("Face detection pipeline → person search and smart album", () => {
  test.use({ e2eSkipStartupAiModelsDownload: false });
  test.setTimeout(600_000);

  test("pipeline embeds faces then tagged person appears in search and Best of Person", async ({
    electronApp,
    mainWindow,
  }) => {
    const expectations = loadExpectations();
    test.skip(!expectations, "Missing expectations.json for face pipeline person discovery");
    test.skip(
      !expectations!.requiredFiles.every((name) => fs.existsSync(path.join(e2ePhotosSourceDir, name))),
      `Missing required test assets in: ${e2ePhotosSourceDir}`,
    );

    const exp = expectations!;
    const libraryDir = createTwoFaceLibraryDir(exp);

    try {
      await waitForSemanticSearchAiReady(mainWindow);
      await waitForArcFaceModelReady(mainWindow);

      await mainWindow.evaluate(async () => {
        const settings = await window.desktopApi.getSettings();
        await window.desktopApi.ensureDetectorModel("yolov12l-face");
        await window.desktopApi.saveSettings({
          ...settings,
          wrongImageRotationDetection: {
            ...settings.wrongImageRotationDetection,
            enabled: false,
            useFaceLandmarkFeaturesFallback: false,
          },
          faceDetection: {
            ...settings.faceDetection,
            detectorModel: "yolov12l-face",
            faceRecognitionSimilarityThreshold: 0.2,
          },
        });
      });

      await mockFolderDialog(electronApp, libraryDir);
      await mainWindow.getByRole("button", { name: "Add library folder" }).click();
      await clickSidebarLibraryRoot(mainWindow, libraryDir);

      await mainWindow.evaluate(async (folderPath) => {
        return window.desktopApi.indexFolderSemanticEmbeddings({
          folderPath,
          mode: "missing",
          recursive: false,
        });
      }, libraryDir);
      await waitForSemanticIndexIdle(mainWindow);

      await mainWindow.evaluate(() => {
        // @ts-expect-error E2E helpers
        window.__e2eFacePipelinePersonUnsub?.();
        // @ts-expect-error E2E helpers
        window.__e2eFacePipelinePersonTargetId = null as string | null;
        // @ts-expect-error E2E helpers
        window.__e2eFacePipelinePersonUnsub = window.desktopApi.pipelines.onLifecycle((evt) => {
          if (evt.type === "bundle-queued" && !window.__e2eFacePipelinePersonTargetId) {
            // @ts-expect-error E2E helpers
            window.__e2eFacePipelinePersonTargetId = evt.bundleId;
          }
        });
      });

      await mainWindow.getByRole("button", { name: "More actions" }).click();
      await mainWindow.locator(".desktop-actions-menu").getByTitle("Start face detection").click();

      await expect
        .poll(async () =>
          mainWindow.evaluate(async () => {
            // @ts-expect-error E2E helpers
            const target = window.__e2eFacePipelinePersonTargetId as string | null;
            if (!target) {
              return false;
            }
            const snap = await window.desktopApi.pipelines.getSnapshot();
            const done = snap.recent.some((b) => b.bundleId === target && b.state === "succeeded");
            const idle = snap.running.length === 0 && snap.queued.length === 0;
            return done && idle;
          }),
        )
        .toBe(true);

      const confirmedPath = path.normalize(path.join(libraryDir, exp.confirmedImage));
      const unconfirmedPath = path.normalize(path.join(libraryDir, exp.unconfirmedImage));

      const embeddingsReady = await mainWindow.evaluate(async (paths: string[]) => {
        const byPath = await window.desktopApi.getMediaItemsByPaths(paths);
        for (const lookupPath of paths) {
          const item = byPath[lookupPath] ?? Object.values(byPath).find((v) => v?.source_path === lookupPath);
          if (!item) {
            return { ok: false as const, reason: `no media item for ${lookupPath}` };
          }
          const faces = await window.desktopApi.listFaceInstancesForMediaItem(item.id);
          if (faces.length === 0) {
            return { ok: false as const, reason: `no faces for ${lookupPath}` };
          }
          if (!faces.every((f) => f.embedding_status === "ready")) {
            return {
              ok: false as const,
              reason: `embedding not ready for ${lookupPath}`,
              statuses: faces.map((f) => f.embedding_status),
            };
          }
        }
        return { ok: true as const };
      }, [confirmedPath, unconfirmedPath]);

      expect(embeddingsReady.ok, JSON.stringify(embeddingsReady)).toBe(true);

      const personTag = await mainWindow.evaluate(async (label) => {
        return window.desktopApi.createPersonTag(label);
      }, exp.personLabel);

      const tagAssign = await mainWindow.evaluate(
        async ({ sourcePath, tagId }) => {
          const byPath = await window.desktopApi.getMediaItemsByPaths([sourcePath]);
          const item = Object.values(byPath)[0];
          if (!item) {
            return { ok: false as const, reason: "no media item" };
          }
          const faces = await window.desktopApi.listFaceInstancesForMediaItem(item.id);
          if (faces.length === 0) {
            return { ok: false as const, reason: "no faces" };
          }
          const assigned = await window.desktopApi.assignPersonTagToFace(faces[0]!.id, tagId);
          return { ok: assigned !== null, faceId: faces[0]!.id };
        },
        { sourcePath: confirmedPath, tagId: personTag.id },
      );
      expect(tagAssign.ok, JSON.stringify(tagAssign)).toBe(true);

      await mainWindow.evaluate(async () => window.desktopApi.refreshPersonSuggestions());

      const strictNames = await mainWindow.evaluate(
        async ({ prompt, tagId }) => {
          const { results } = await window.desktopApi.semanticSearchPhotos({
            query: prompt,
            limit: 100,
            personTagIds: [tagId],
            includeUnconfirmedFaces: false,
          });
          return results.map((r: { name: string }) => r.name);
        },
        { prompt: exp.searchPrompt, tagId: personTag.id },
      );
      expect(strictNames).toContain(exp.confirmedImage);
      expect(strictNames).not.toContain(exp.unconfirmedImage);

      const expandedNames = await mainWindow.evaluate(
        async ({ prompt, tagId }) => {
          const { results } = await window.desktopApi.semanticSearchPhotos({
            query: prompt,
            limit: 100,
            personTagIds: [tagId],
            includeUnconfirmedFaces: true,
          });
          return results.map((r: { name: string }) => r.name);
        },
        { prompt: exp.searchPrompt, tagId: personTag.id },
      );
      expect(expandedNames).toContain(exp.confirmedImage);
      expect(expandedNames).toContain(exp.unconfirmedImage);

      const smartAlbum = await mainWindow.evaluate(async (tagId) => {
        return window.desktopApi.listSmartAlbumItems({
          kind: "best-of-person-people",
          personTagIds: [tagId],
          filters: { includeUnconfirmedFaces: true },
          limit: 50,
          offset: 0,
        });
      }, personTag.id);

      const smartAlbumNames = smartAlbum.rows.map((row: { sourcePath: string }) => {
        const normalized = row.sourcePath.replace(/\\/g, "/");
        return normalized.slice(normalized.lastIndexOf("/") + 1);
      });
      expect(smartAlbumNames).toContain(exp.confirmedImage);
      expect(smartAlbumNames).toContain(exp.unconfirmedImage);
    } finally {
      await mainWindow.evaluate(() => {
        // @ts-expect-error E2E helpers
        window.__e2eFacePipelinePersonUnsub?.();
      });
      fs.rmSync(libraryDir, { recursive: true, force: true });
    }
  });
});

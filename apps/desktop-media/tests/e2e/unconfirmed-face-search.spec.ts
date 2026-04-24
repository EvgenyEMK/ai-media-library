import fs from "node:fs";
import path from "node:path";
import { test, expect } from "./fixtures/app-fixture";
import { clickSidebarLibraryRoot } from "./fixtures/desktop-sidebar";
import { mockFolderDialog } from "./fixtures/mock-dialog";
import { waitForArcFaceModelReady, waitForSemanticSearchAiReady } from "./fixtures/e2e-ai-ready";
import { waitForSemanticIndexIdle } from "./fixtures/semantic-index-wait";

const defaultAssetsDir = path.resolve(__dirname, "../../test-assets-local/e2e-photos");
const configuredAssetsDir = process.env.EMK_E2E_PHOTOS_DIR?.trim();
const e2ePhotosDir = configuredAssetsDir && configuredAssetsDir.length > 0
  ? configuredAssetsDir
  : defaultAssetsDir;

const expectationsPath = path.join(defaultAssetsDir, "expectations.json");

interface UnconfirmedFaceExpectations {
  personLabel: string;
  confirmedImage: string;
  unconfirmedImage: string;
  searchPrompt: string;
  requiredFiles: string[];
}

function loadExpectations(): UnconfirmedFaceExpectations | null {
  if (!fs.existsSync(expectationsPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(expectationsPath, "utf-8")) as {
      unconfirmedFaceSearch?: UnconfirmedFaceExpectations;
    };
    return raw.unconfirmedFaceSearch ?? null;
  } catch {
    return null;
  }
}

function hasRequiredAssets(expectations: UnconfirmedFaceExpectations): boolean {
  if (!fs.existsSync(e2ePhotosDir)) return false;
  return expectations.requiredFiles.every((name) =>
    fs.existsSync(path.join(e2ePhotosDir, name)),
  );
}

test.describe("Unconfirmed face search", () => {
  test.setTimeout(600_000);

  test("toggle expands person-tag filter to include unconfirmed similar faces", async ({
    electronApp,
    mainWindow,
  }) => {
    const expectations = loadExpectations();
    test.skip(!expectations, "Missing expectations.json for unconfirmed face search");
    test.skip(
      !hasRequiredAssets(expectations!),
      `Missing required test assets in: ${e2ePhotosDir}`,
    );

    const exp = expectations!;

    // Capture main-process logs for diagnostics
    const proc = electronApp.process();
    proc.stdout?.on("data", (data: Buffer) => {
      for (const line of data.toString().split("\n").filter(Boolean)) {
        console.log("[electron]", line);
      }
    });

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

    // Set up library folder
    await mockFolderDialog(electronApp, e2ePhotosDir);
    await mainWindow.getByText("Add library folder").click();
    await clickSidebarLibraryRoot(mainWindow, e2ePhotosDir);
    await mainWindow.waitForTimeout(2_000);

    // Step 1: Semantic index
    console.log("[test] Step 1: Building semantic index...");
    await mainWindow.evaluate(async (folderPath) => {
      return window.desktopApi.indexFolderSemanticEmbeddings({
        folderPath,
        mode: "missing",
        recursive: false,
      });
    }, e2ePhotosDir);
    await waitForSemanticIndexIdle(mainWindow);
    console.log("[test] Semantic index complete.");

    // Step 2: Face detection on both images
    console.log("[test] Step 2: Running face detection...");
    const confirmedPath = path.join(e2ePhotosDir, exp.confirmedImage);
    const unconfirmedPath = path.join(e2ePhotosDir, exp.unconfirmedImage);

    const detResult1 = await mainWindow.evaluate(async (sourcePath) => {
      const settings = await window.desktopApi.getSettings();
      return window.desktopApi.detectFacesForMediaItem(sourcePath, settings.faceDetection);
    }, confirmedPath);
    console.log(`[test] Face detection on confirmed image: ${detResult1.faceCount} faces`);
    expect(detResult1.faceCount).toBeGreaterThan(0);

    const detResult2 = await mainWindow.evaluate(async (sourcePath) => {
      const settings = await window.desktopApi.getSettings();
      return window.desktopApi.detectFacesForMediaItem(sourcePath, settings.faceDetection);
    }, unconfirmedPath);
    console.log(`[test] Face detection on unconfirmed image: ${detResult2.faceCount} faces`);
    expect(detResult2.faceCount).toBeGreaterThan(0);

    // Step 3: Generate face embeddings
    console.log("[test] Step 3: Generating face embeddings...");
    const embedResult = await mainWindow.evaluate(async (folderPath) => {
      return window.desktopApi.embedFolderFaces({ folderPath });
    }, e2ePhotosDir);
    console.log(`[test] Embedding job started: ${embedResult.total} faces`);

    // Wait for embedding job to finish
    await mainWindow.waitForTimeout(5_000);
    const embedStats = await mainWindow.evaluate(async () => {
      return window.desktopApi.getEmbeddingStats();
    });
    console.log(`[test] Embedding stats: ${JSON.stringify(embedStats)}`);

    // Step 4: Tag confirmed-image face (fixture has a single person/face).
    console.log("[test] Step 4: Assigning person tag on confirmed image...");
    const confirmedMediaItem = await mainWindow.evaluate(async (sourcePath) => {
      const items = await window.desktopApi.getMediaItemsByPaths([sourcePath]);
      return Object.values(items)[0] ?? null;
    }, confirmedPath);
    expect(confirmedMediaItem).not.toBeNull();
    const confirmedFaces = await mainWindow.evaluate(
      async (mediaItemId) => window.desktopApi.listFaceInstancesForMediaItem(mediaItemId),
      confirmedMediaItem!.id,
    );
    expect(confirmedFaces.length).toBeGreaterThan(0);

    const faceToTag = confirmedFaces[0].id;
    console.log(`[test] Using confirmed face as tag reference: ${faceToTag}`);

    const personTag = await mainWindow.evaluate(
      async (label) => window.desktopApi.createPersonTag(label),
      exp.personLabel,
    );
    console.log(`[test] Created person tag: ${personTag.id} (${personTag.label})`);

    const assignResult = await mainWindow.evaluate(
      async ({ faceId, tagId }) => window.desktopApi.assignPersonTagToFace(faceId, tagId),
      { faceId: faceToTag, tagId: personTag.id },
    );
    console.log(`[test] Face assigned: ${assignResult !== null}`);
    expect(assignResult).not.toBeNull();

    // Step 5: Refresh person suggestions
    console.log("[test] Step 5: Refreshing person suggestions...");
    const refreshResult = await mainWindow.evaluate(async () => {
      return window.desktopApi.refreshPersonSuggestions();
    });
    console.log(`[test] Suggestions refreshed: ${refreshResult.count} suggestions`);

    // Step 6: Search WITHOUT unconfirmed toggle
    console.log("[test] Step 6: Searching without unconfirmed toggle...");
    const strictResults = await mainWindow.evaluate(
      async ({ prompt, tagId }) => {
        const { results } = await window.desktopApi.semanticSearchPhotos({
          query: prompt,
          limit: 100,
          personTagIds: [tagId],
          includeUnconfirmedFaces: false,
        });
        return results.map((r: { name: string; score: number }) => ({
          name: r.name,
          score: r.score,
        }));
      },
      { prompt: exp.searchPrompt, tagId: personTag.id },
    );
    console.log(`[test] Strict results (${strictResults.length}):`, strictResults.map(
      (r: { name: string; score: number }) => `${r.name}=${r.score.toFixed(4)}`
    ));

    const strictNames = strictResults.map((r: { name: string }) => r.name);
    expect(strictNames).toContain(exp.confirmedImage);
    expect(strictNames).not.toContain(exp.unconfirmedImage);

    // Step 7: Search WITH unconfirmed toggle
    console.log("[test] Step 7: Searching with unconfirmed toggle...");
    const expandedResults = await mainWindow.evaluate(
      async ({ prompt, tagId }) => {
        const { results } = await window.desktopApi.semanticSearchPhotos({
          query: prompt,
          limit: 100,
          personTagIds: [tagId],
          includeUnconfirmedFaces: true,
        });
        return results.map((r: { name: string; score: number }) => ({
          name: r.name,
          score: r.score,
        }));
      },
      { prompt: exp.searchPrompt, tagId: personTag.id },
    );
    console.log(`[test] Expanded results (${expandedResults.length}):`, expandedResults.map(
      (r: { name: string; score: number }) => `${r.name}=${r.score.toFixed(4)}`
    ));

    const expandedNames = expandedResults.map((r: { name: string }) => r.name);
    expect(expandedNames).toContain(exp.confirmedImage);
    expect(expandedNames).toContain(exp.unconfirmedImage);

    // Expanded results should include more items than strict results
    expect(expandedResults.length).toBeGreaterThan(strictResults.length);
    console.log(
      `[test] Strict: ${strictResults.length} results, Expanded: ${expandedResults.length} results (+${expandedResults.length - strictResults.length} unconfirmed)`,
    );
  });

  test("refreshPersonSuggestions IPC returns suggestion count", async ({
    electronApp,
    mainWindow,
  }) => {
    const expectations = loadExpectations();
    test.skip(!expectations, "Missing expectations.json for unconfirmed face search");
    test.skip(
      !hasRequiredAssets(expectations!),
      `Missing required test assets in: ${e2ePhotosDir}`,
    );

    await waitForArcFaceModelReady(mainWindow);

    await mainWindow.evaluate(async () => {
      const settings = await window.desktopApi.getSettings();
      await window.desktopApi.ensureDetectorModel("yolov12s-face");
      await window.desktopApi.saveSettings({
        ...settings,
        wrongImageRotationDetection: {
          ...settings.wrongImageRotationDetection,
          enabled: true,
          useFaceLandmarkFeaturesFallback: true,
        },
        faceDetection: {
          ...settings.faceDetection,
          detectorModel: "yolov12s-face",
        },
      });
    });

    // Set up library folder
    await mockFolderDialog(electronApp, e2ePhotosDir);
    await mainWindow.getByText("Add library folder").click();
    await clickSidebarLibraryRoot(mainWindow, e2ePhotosDir);
    await mainWindow.waitForTimeout(2_000);

    // Run face detection and embedding
    const exp = expectations!;
    const confirmedPath = path.join(e2ePhotosDir, exp.confirmedImage);
    await mainWindow.evaluate(
      async (sourcePath) => window.desktopApi.detectFacesForMediaItem(sourcePath),
      confirmedPath,
    );
    await mainWindow.evaluate(async (folderPath) => {
      return window.desktopApi.embedFolderFaces({ folderPath });
    }, e2ePhotosDir);
    await mainWindow.waitForTimeout(5_000);

    // Create person tag and assign face
    const personTag = await mainWindow.evaluate(
      async (label) => window.desktopApi.createPersonTag(label),
      `${exp.personLabel}-smoke`,
    );

    const confirmedMediaItem = await mainWindow.evaluate(async (sourcePath) => {
      const items = await window.desktopApi.getMediaItemsByPaths([sourcePath]);
      return Object.values(items)[0] ?? null;
    }, confirmedPath);

    if (confirmedMediaItem) {
      const faces = await mainWindow.evaluate(
        async (mediaItemId) => window.desktopApi.listFaceInstancesForMediaItem(mediaItemId),
        confirmedMediaItem.id,
      );
      if (faces.length > 0) {
        await mainWindow.evaluate(
          async ({ faceId, tagId }) => window.desktopApi.assignPersonTagToFace(faceId, tagId),
          { faceId: faces[0].id, tagId: personTag.id },
        );
      }
    }

    // Call refreshPersonSuggestions and verify it returns a valid result
    const result = await mainWindow.evaluate(async () => {
      return window.desktopApi.refreshPersonSuggestions();
    });
    console.log(`[test] refreshPersonSuggestions returned count=${result.count}`);
    expect(result).toHaveProperty("count");
    expect(typeof result.count).toBe("number");
    expect(result.count).toBeGreaterThanOrEqual(0);
  });
});

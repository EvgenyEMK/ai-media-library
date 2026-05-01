import { test, expect } from "./fixtures/app-fixture";
import { clickSidebarLibraryRoot } from "./fixtures/desktop-sidebar";
import { mockFolderDialog } from "./fixtures/mock-dialog";
import { createTestImageFolder, removeTestImageFolder } from "./fixtures/test-images";

let testFolder: string;

test.use({ ollamaMock: { failFirstChatRequests: 40 } });

test.beforeAll(() => {
  testFolder = createTestImageFolder(20);
});

test.afterAll(() => {
  removeTestImageFolder(testFolder);
});

test("cancel during warmup resets running menu state", async ({ electronApp, mainWindow }) => {
  await mockFolderDialog(electronApp, testFolder);
  await mainWindow.getByText("Add library folder").click();
  await clickSidebarLibraryRoot(mainWindow, testFolder);

  const actionsButton = mainWindow.getByRole("button", { name: "More actions" });
  await actionsButton.click();
  const menu = mainWindow.locator(".desktop-actions-menu");
  const aiRow = menu.locator(".photo-ai-row").first();
  await aiRow.locator('button.face-detect-play-btn[title="Start image AI analysis"]').click();

  // Warmup should be visible in background operations (model name is included in copy).
  await expect(mainWindow.getByText(/Loading AI model .*it may take 1-2min/)).toBeVisible({
    timeout: 10_000,
  });

  const pipelineQueue = mainWindow.getByLabel("Pipeline queue");
  await expect(pipelineQueue).toBeVisible({ timeout: 10_000 });
  await pipelineQueue.getByRole("button", { name: /Cancel Photo analysis/ }).click();

  // Reopen menu and ensure action is no longer stuck in running mode.
  await actionsButton.click();
  await expect(mainWindow.locator(".desktop-actions-menu")).toBeVisible({ timeout: 10_000 });
  await expect(
    mainWindow.locator('.desktop-actions-menu .photo-ai-row button.face-detect-play-btn[title="Cancel image AI analysis"]'),
  ).toBeHidden({ timeout: 20_000 });
  await expect(
    mainWindow.locator('.desktop-actions-menu .photo-ai-row button.face-detect-play-btn[title="Start image AI analysis"]'),
  ).toBeVisible({ timeout: 20_000 });
});


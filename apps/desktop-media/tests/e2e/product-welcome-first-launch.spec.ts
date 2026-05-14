import { test, expect } from "./fixtures/app-fixture";

test.describe("Product welcome first launch", () => {
  test.use({ e2eAllowAutoProductIntro: true });

  test("welcome wizard is visible before adding a library folder", async ({ mainWindow }) => {
    const welcomeHeading = mainWindow.getByRole("heading", { name: "Welcome to AI Media Library", exact: true });
    await expect(welcomeHeading).toBeVisible({ timeout: 90_000 });

    await expect(mainWindow.getByText("Contextual image search")).toBeVisible();
    await expect(mainWindow.getByRole("main").getByText("Select a folder to view media").first()).toBeVisible();
  });
});

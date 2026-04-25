import { test, expect } from "../e2e/fixtures/app-fixture";

test.describe("Albums", () => {
  test("creates an album and opens its detail view", async ({ mainWindow }) => {
    const albumTitle = `E2E Album ${Date.now()}`;

    await mainWindow.getByRole("button", { name: "Albums" }).click();
    const mainPanel = mainWindow.locator("main.main-panel");
    await expect(mainPanel.getByRole("heading", { name: "Albums" })).toBeVisible();

    await mainPanel.getByRole("button", { name: "Create album" }).click();
    await mainPanel.getByPlaceholder("New album title").fill(albumTitle);
    await mainPanel.getByRole("button", { name: "Create" }).click();

    await expect(mainPanel.getByRole("heading", { name: albumTitle })).toBeVisible();
    await expect(mainPanel.getByText("This album is empty.")).toBeVisible();

    await mainPanel.getByRole("button", { name: "Back to albums" }).click();
    await expect(mainPanel.getByRole("button", { name: albumTitle })).toBeVisible();
  });
});

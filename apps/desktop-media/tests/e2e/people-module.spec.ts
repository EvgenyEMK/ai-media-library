import { test, expect } from "../e2e/fixtures/app-fixture";

test.describe("People module", () => {
  test("opens People list from sidebar; add row shows BIRTH DATE column", async ({ mainWindow }) => {
    await mainWindow.getByRole("complementary").getByRole("button", { name: "People" }).click();
    await expect(mainWindow.getByTestId("people-tags-list-tab")).toBeVisible();
    await expect(mainWindow.getByRole("heading", { level: 1, name: "People" })).toBeVisible();
    await mainWindow.getByRole("button", { name: "Add person" }).click();
    await expect(mainWindow.getByText("BIRTH DATE", { exact: true })).toBeVisible();
    await expect(mainWindow.getByText("YYYY-MM-DD", { exact: true })).toBeVisible();
  });

  test("People onboarding opens from help and shows first slide", async ({ mainWindow }) => {
    await mainWindow.getByRole("complementary").getByRole("button", { name: "People" }).click();
    await mainWindow.getByRole("button", { name: "About People tags and birth dates" }).click();
    await expect(mainWindow.getByRole("heading", { name: "People tags" })).toBeVisible();
    await expect(
      mainWindow.getByText("Organize photos around the people who matter", { exact: true }),
    ).toBeVisible();
  });

  test("Add person reveals inline row with name field", async ({ mainWindow }) => {
    await mainWindow.getByRole("complementary").getByRole("button", { name: "People" }).click();
    await mainWindow.getByRole("button", { name: "Add person" }).click();
    await expect(mainWindow.getByPlaceholder("Name")).toBeVisible();
    await expect(mainWindow.getByPlaceholder("YYYY-MM-DD")).toBeVisible();
  });

  test("People groups tab shows groups workspace", async ({ mainWindow }) => {
    await mainWindow.getByRole("complementary").getByRole("button", { name: "People" }).click();
    await mainWindow.getByRole("button", { name: "People groups" }).click();
    await expect(mainWindow.getByRole("heading", { level: 1, name: "People groups" })).toBeVisible();
    await expect(
      mainWindow.getByText("Organize people into named groups.", { exact: false }),
    ).toBeVisible();
  });
});

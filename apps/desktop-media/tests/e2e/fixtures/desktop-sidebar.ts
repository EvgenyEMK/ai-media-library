import path from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Desktop shell uses `<aside>` (implicit `complementary`); folder rows live under
 * `MainAppSidebar`'s `<nav>` so we scope there to avoid matching unrelated landmarks.
 */
export function mainDesktopSidebar(page: Page): Locator {
  return page.getByRole("complementary").getByRole("navigation");
}

/**
 * Clicks a library root row. Root nodes use the full resolved path as the tree label
 * (see SidebarTree: `label={rootPath}` for roots).
 */
export async function clickSidebarLibraryRoot(page: Page, libraryRootPath: string): Promise<void> {
  const normalized = path.normalize(libraryRootPath);
  const aside = page.getByRole("complementary");
  await page.keyboard.press("Escape");
  const expandSidebar = aside.getByRole("button", { name: "Expand", exact: true });
  if ((await expandSidebar.count()) > 0) {
    await expandSidebar.first().click();
  }
  const btn = mainDesktopSidebar(page).getByRole("button", { name: normalized, exact: true });
  await btn.waitFor({ state: "visible", timeout: 60_000 });
  await expect(async () => {
    await btn.click({ timeout: 15_000 });
  }).toPass({ timeout: 60_000 });
}

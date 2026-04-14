import path from "node:path";
import type { Locator, Page } from "@playwright/test";

/** Desktop shell uses `<aside>` without a `.sidebar` class; landmark role is complementary. */
export function mainDesktopSidebar(page: Page): Locator {
  return page.getByRole("complementary");
}

/**
 * Clicks a library root row. Root nodes use the full resolved path as the tree label
 * (see SidebarTree: `label={rootPath}` for roots).
 */
export async function clickSidebarLibraryRoot(page: Page, libraryRootPath: string): Promise<void> {
  const normalized = path.normalize(libraryRootPath);
  await mainDesktopSidebar(page).getByRole("button", { name: normalized, exact: true }).click();
}

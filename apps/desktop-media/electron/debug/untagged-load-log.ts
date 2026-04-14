/**
 * Diagnostics for the People → Untagged faces tab load path.
 *
 * Enable main-process timing logs:
 *   EMK_DEBUG_UNTAGGED_LOAD=1
 *
 * Logs appear in the terminal that launched Electron (not the DevTools console).
 */

export function shouldLogUntaggedLoadMain(): boolean {
  const v = process.env.EMK_DEBUG_UNTAGGED_LOAD?.toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function logUntaggedLoadMain(
  scope: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!shouldLogUntaggedLoadMain()) return;
  const payload = data && Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : "";
  console.log(`[emk:untagged-load][main][${scope}] ${message}${payload}`);
}

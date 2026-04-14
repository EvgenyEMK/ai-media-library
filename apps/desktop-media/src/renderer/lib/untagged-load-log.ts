/**
 * Renderer-side timing for the Untagged faces tab.
 *
 * Logs when **either**:
 * - Vite dev build (`import.meta.env.DEV`), or
 * - `sessionStorage.setItem("emkDebugUntagged", "1")` then reload (works in packaged app after opening DevTools).
 */

function isViteDevBuild(): boolean {
  try {
    return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
  } catch {
    return false;
  }
}

export function shouldLogUntaggedLoadRenderer(): boolean {
  if (isViteDevBuild()) return true;
  try {
    return sessionStorage.getItem("emkDebugUntagged") === "1";
  } catch {
    return false;
  }
}

export function logUntaggedLoadRenderer(
  step: string,
  ms: number,
  extra?: Record<string, unknown>,
): void {
  if (!shouldLogUntaggedLoadRenderer()) return;
  const base = { step, ms: Math.round(ms * 100) / 100, ...extra };
  console.log("[emk:untagged-load][renderer]", base);
}

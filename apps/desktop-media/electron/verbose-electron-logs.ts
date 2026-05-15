/** Opt-in noisy main-process logs (semantic search/index, power-save). Set `EMK_VERBOSE_ELECTRON_LOGS=1`. */
export function isVerboseElectronLogsEnabled(): boolean {
  return process.env.EMK_VERBOSE_ELECTRON_LOGS === "1";
}

/**
 * Logs to **stderr** so lines show next to Chromium/Electron errors (often stderr)
 * and are less likely to be line-buffered away from the terminal than stdout.
 * Does not appear in the renderer DevTools console — only in the process that runs Electron (e.g. `pnpm dev` terminal).
 */
export function logVerbose(...args: Parameters<typeof console.log>): void {
  if (!isVerboseElectronLogsEnabled()) return;
  console.error(...args);
}

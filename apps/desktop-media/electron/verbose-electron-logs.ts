/** Opt-in noisy main-process logs (semantic search/index, power-save). Set `EMK_VERBOSE_ELECTRON_LOGS=1`. */
export function isVerboseElectronLogsEnabled(): boolean {
  return process.env.EMK_VERBOSE_ELECTRON_LOGS === "1";
}

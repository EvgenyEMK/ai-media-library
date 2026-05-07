/**
 * Gates bundled ONNX / native AI weight downloads kicked off from main-process startup.
 * Playwright sets {@link EMK_E2E_SKIP_STARTUP_AI_MODELS_DOWNLOAD} so cold E2E runs skip work
 * tests do not need; extend this module when new startup model pipelines are added.
 */
export const EMK_E2E_SKIP_STARTUP_AI_MODELS_DOWNLOAD = "EMK_E2E_SKIP_STARTUP_AI_MODELS_DOWNLOAD";

export function shouldSkipStartupAiModelsDownload(): boolean {
  return process.env[EMK_E2E_SKIP_STARTUP_AI_MODELS_DOWNLOAD] === "1";
}

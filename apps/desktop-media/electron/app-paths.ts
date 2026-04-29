import path from "node:path";
import type { App } from "electron";

const RUNTIME_ROOT_DIR_NAME = "EMK Desktop Media";
const RUNTIME_ROOT_ENV_NAME = "EMK_DESKTOP_RUNTIME_ROOT_PATH";

/**
 * Runtime-only files (cache/session/models) must stay in a stable default path
 * and must not follow user-selected DB/userData location.
 */
export function resolveRuntimeRoot(app: App): string {
  const configuredRoot = process.env[RUNTIME_ROOT_ENV_NAME]?.trim();
  if (configuredRoot) {
    return configuredRoot;
  }
  return path.join(app.getPath("appData"), RUNTIME_ROOT_DIR_NAME);
}

export function resolveCacheRoot(app: App): string {
  return path.join(resolveRuntimeRoot(app), "cache");
}

export function resolveSessionDataPath(app: App): string {
  return path.join(resolveCacheRoot(app), "session-data");
}

export function resolveModelsPath(app: App): string {
  return path.join(resolveRuntimeRoot(app), "ai-models");
}

export function resolveGeonamesPath(app: App): string {
  return path.join(resolveRuntimeRoot(app), "geonames");
}

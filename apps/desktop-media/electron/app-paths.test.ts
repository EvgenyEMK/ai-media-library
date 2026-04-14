import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveCacheRoot,
  resolveModelsPath,
  resolveRuntimeRoot,
  resolveSessionDataPath,
} from "./app-paths";

type MinimalApp = {
  getPath: (name: string) => string;
};

function createAppMock(appDataPath: string): MinimalApp {
  return {
    getPath(name: string): string {
      if (name === "appData") return appDataPath;
      throw new Error(`Unexpected getPath(${name}) in test`);
    },
  };
}

describe("app-paths", () => {
  it("places runtime folders under appData/EMK Desktop Media", () => {
    const appData = "C:/Users/test/AppData/Roaming";
    const app = createAppMock(appData) as never;
    const runtimeRoot = path.join(appData, "EMK Desktop Media");
    expect(resolveRuntimeRoot(app)).toBe(runtimeRoot);
    expect(resolveCacheRoot(app)).toBe(path.join(runtimeRoot, "cache"));
    expect(resolveSessionDataPath(app)).toBe(path.join(runtimeRoot, "cache", "session-data"));
    expect(resolveModelsPath(app)).toBe(path.join(runtimeRoot, "ai-models"));
  });
});

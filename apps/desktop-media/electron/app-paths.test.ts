import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  resolveCacheRoot,
  resolveGeonamesPath,
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
  afterEach(() => {
    delete process.env.EMK_DESKTOP_RUNTIME_ROOT_PATH;
  });

  it("places runtime folders under appData/EMK Desktop Media", () => {
    const appData = "C:/Users/test/AppData/Roaming";
    const app = createAppMock(appData) as never;
    const runtimeRoot = path.join(appData, "EMK Desktop Media");
    expect(resolveRuntimeRoot(app)).toBe(runtimeRoot);
    expect(resolveCacheRoot(app)).toBe(path.join(runtimeRoot, "cache"));
    expect(resolveSessionDataPath(app)).toBe(path.join(runtimeRoot, "cache", "session-data"));
    expect(resolveModelsPath(app)).toBe(path.join(runtimeRoot, "ai-models"));
    expect(resolveGeonamesPath(app)).toBe(path.join(runtimeRoot, "geonames"));
  });

  it("uses the runtime root override when provided", () => {
    process.env.EMK_DESKTOP_RUNTIME_ROOT_PATH = "D:/EMK/runtime";
    const app = createAppMock("C:/Users/test/AppData/Roaming") as never;

    expect(resolveRuntimeRoot(app)).toBe("D:/EMK/runtime");
    expect(resolveModelsPath(app)).toBe(path.join("D:/EMK/runtime", "ai-models"));
    expect(resolveGeonamesPath(app)).toBe(path.join("D:/EMK/runtime", "geonames"));
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  EMK_E2E_SKIP_STARTUP_AI_MODELS_DOWNLOAD,
  shouldSkipStartupAiModelsDownload,
} from "./startup-ai-models";

describe("shouldSkipStartupAiModelsDownload", () => {
  beforeEach(() => {
    delete process.env[EMK_E2E_SKIP_STARTUP_AI_MODELS_DOWNLOAD];
  });
  afterEach(() => {
    delete process.env[EMK_E2E_SKIP_STARTUP_AI_MODELS_DOWNLOAD];
  });

  it("is false when unset", () => {
    expect(shouldSkipStartupAiModelsDownload()).toBe(false);
  });

  it("is true when env is 1", () => {
    process.env[EMK_E2E_SKIP_STARTUP_AI_MODELS_DOWNLOAD] = "1";
    expect(shouldSkipStartupAiModelsDownload()).toBe(true);
  });
});

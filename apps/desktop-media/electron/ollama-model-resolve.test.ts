import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OLLAMA_TEXT_FALLBACK_MODEL,
  OLLAMA_TEXT_PRIMARY_MODEL,
  resolveOllamaTextChatModel,
} from "./ollama-model-resolve";

describe("resolveOllamaTextChatModel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns preferred when it exists in /api/tags", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [{ name: "custom:tag" }, { name: OLLAMA_TEXT_PRIMARY_MODEL }] }),
      }),
    );
    await expect(resolveOllamaTextChatModel({ preferred: "custom:tag" })).resolves.toBe("custom:tag");
  });

  it("falls back to primary when preferred is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [{ name: OLLAMA_TEXT_PRIMARY_MODEL }] }),
      }),
    );
    await expect(resolveOllamaTextChatModel({ preferred: "not-installed" })).resolves.toBe(
      OLLAMA_TEXT_PRIMARY_MODEL,
    );
  });

  it("uses 9b fallback when primary missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [{ name: OLLAMA_TEXT_FALLBACK_MODEL }] }),
      }),
    );
    await expect(resolveOllamaTextChatModel({})).resolves.toBe(OLLAMA_TEXT_FALLBACK_MODEL);
  });

  it("returns null when tags are empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      }),
    );
    await expect(resolveOllamaTextChatModel({})).resolves.toBeNull();
  });
});

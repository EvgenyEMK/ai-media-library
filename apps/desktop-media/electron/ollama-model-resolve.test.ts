import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertOllamaModelInstalled,
  isOllamaModelInTagList,
  OLLAMA_TEXT_FALLBACK_MODEL,
  OLLAMA_TEXT_PRIMARY_MODEL,
  resolveOllamaTextChatModel,
} from "./ollama-model-resolve";

describe("isOllamaModelInTagList", () => {
  it("matches exact model ids from /api/tags", () => {
    expect(isOllamaModelInTagList("qwen3.5:9b", ["llava:latest", "qwen3.5:9b"])).toBe(true);
  });

  it("does not match missing models", () => {
    expect(isOllamaModelInTagList("qwen3.5:9c", ["qwen3.5:9b"])).toBe(false);
  });
});

describe("assertOllamaModelInstalled", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves when the model is listed in /api/tags", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [{ name: "qwen3.5:9b" }] }),
      }),
    );
    await expect(assertOllamaModelInstalled("qwen3.5:9b")).resolves.toBeUndefined();
  });

  it("throws immediately when the model is not installed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [{ name: "qwen3.5:9b" }] }),
      }),
    );
    await expect(assertOllamaModelInstalled("qwen3.5:9c")).rejects.toThrow(
      'Ollama does not have model "qwen3.5:9c" installed.',
    );
  });

  it("throws when Ollama is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await expect(assertOllamaModelInstalled("qwen3.5:9b")).rejects.toThrow(
      'Cannot reach Ollama to verify model "qwen3.5:9b".',
    );
  });
});

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

import { describe, expect, it } from "vitest";
import { MOCK_OLLAMA_INSTALLED_MODELS, startMockOllamaServer } from "./mock-ollama";

describe("startMockOllamaServer", () => {
  it("lists installed models from GET /api/tags", async () => {
    const server = await startMockOllamaServer();
    try {
      const res = await fetch(`${server.baseUrl}/api/tags`);
      expect(res.ok).toBe(true);
      const body = (await res.json()) as { models?: Array<{ name: string }> };
      expect(body.models?.map((m) => m.name)).toEqual([...MOCK_OLLAMA_INSTALLED_MODELS]);
    } finally {
      await server.close();
    }
  });
});

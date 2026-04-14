/**
 * Hit Ollama with the same system/user prompts as advanced search query understanding.
 *
 * From apps/desktop-media: pnpm exec tsx scripts/test-query-understanding-ollama.ts
 * Args: [query] [model]
 *
 * Requires Ollama at http://127.0.0.1:11434
 */
import { getQueryUnderstandingPrompts } from "../electron/query-understanding";

const query = process.argv[2] ?? "маленький мальчик в бумажном замке";
const model = process.argv[3] ?? "qwen2.5vl:3b";

async function main(): Promise<void> {
  const { system, user } = getQueryUnderstandingPrompts(query);

  const res = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  const body = (await res.json()) as { message?: { content?: string } };
  console.log("HTTP", res.status);
  console.log("message.content:\n", body.message?.content ?? "(empty)");
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});

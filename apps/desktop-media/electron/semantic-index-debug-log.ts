import fs from "node:fs/promises";
import path from "node:path";

const LOG_FILE_NAME = "semantic-index-debug.log";
let debugLogPath: string | null = null;
const DEBUG_LOG_ENABLED = process.env.EMK_SEMANTIC_DEBUG_LOGS === "1";

export function setSemanticIndexDebugLogPath(userDataPath: string): void {
  if (!DEBUG_LOG_ENABLED) {
    debugLogPath = null;
    return;
  }
  debugLogPath = path.join(userDataPath, LOG_FILE_NAME);
}

export function getSemanticIndexDebugLogPath(): string | null {
  if (!DEBUG_LOG_ENABLED) return null;
  return debugLogPath;
}

export async function logSemanticIndexDebug(message: string): Promise<void> {
  if (!DEBUG_LOG_ENABLED || !debugLogPath) return;
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    await fs.appendFile(debugLogPath, line, "utf8");
  } catch {
    // Best-effort diagnostics; never fail pipeline on log I/O.
  }
}

export async function readSemanticIndexDebugLogTail(
  maxBytes = 64 * 1024,
): Promise<{ path: string | null; content: string }> {
  if (!DEBUG_LOG_ENABLED || !debugLogPath) {
    return { path: null, content: "" };
  }
  try {
    const stat = await fs.stat(debugLogPath);
    const start = Math.max(0, stat.size - maxBytes);
    const buffer = await fs.readFile(debugLogPath);
    return {
      path: debugLogPath,
      content: buffer.subarray(start).toString("utf8"),
    };
  } catch {
    return { path: debugLogPath, content: "" };
  }
}

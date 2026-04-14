import { execSync, spawnSync } from "node:child_process";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run");
const workspaceRoot = path.resolve(process.cwd());
const normalizedWorkspaceRoot = normalizePath(workspaceRoot);

const PROCESS_NAMES = new Set(["node", "node.exe", "electron", "electron.exe"]);
const COMMAND_MATCHERS = [
  "desktop-media",
  "scripts/dev.mjs",
  "dist-electron/main.js",
  "dist-electron\\main.js",
  "vite.main.config.ts",
  "vite.renderer.config.ts",
];

function normalizePath(value) {
  return value.replace(/\\/g, "/").toLowerCase();
}

function parseWindowsProcesses() {
  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_Process | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress",
    ],
    { encoding: "utf8" },
  );

  if (result.status !== 0 || !result.stdout.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(result.stdout);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function parseUnixProcesses() {
  try {
    const output = execSync("ps -axo pid=,comm=,command=", { encoding: "utf8" });
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(\d+)\s+(\S+)\s+(.*)$/);
        if (!match) return null;
        const [, pid, name, commandLine] = match;
        return {
          ProcessId: Number(pid),
          Name: name,
          CommandLine: commandLine,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function listProcesses() {
  return process.platform === "win32" ? parseWindowsProcesses() : parseUnixProcesses();
}

function shouldKillProcess(entry) {
  const pid = Number(entry?.ProcessId);
  const rawName = typeof entry?.Name === "string" ? entry.Name : "";
  const rawCommand = typeof entry?.CommandLine === "string" ? entry.CommandLine : "";
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) {
    return false;
  }

  const name = rawName.toLowerCase();
  if (!PROCESS_NAMES.has(name)) {
    return false;
  }

  const command = normalizePath(rawCommand);
  if (!command.includes(normalizedWorkspaceRoot)) {
    return false;
  }

  // Kill any Electron process from this workspace; renderer/gpu children may not include desktop markers.
  if (name === "electron.exe" || name === "electron") {
    return true;
  }

  return COMMAND_MATCHERS.some((token) => command.includes(normalizePath(token)));
}

function killPid(pid) {
  try {
    if (process.platform === "win32") {
      // Kill full process tree to avoid detached Electron child processes.
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}

const candidates = listProcesses().filter(shouldKillProcess);
const pidsToKill = [...new Set(candidates.map((entry) => Number(entry.ProcessId)))];

if (pidsToKill.length === 0) {
  console.log("[desktop-clean] No stale desktop dev processes found.");
  process.exit(0);
}

if (isDryRun) {
  console.log(`[desktop-clean] Dry run. Would kill ${pidsToKill.length} processes: ${pidsToKill.join(", ")}`);
  process.exit(0);
}

const killed = pidsToKill.filter(killPid);
const failed = pidsToKill.filter((pid) => !killed.includes(pid));

if (killed.length > 0) {
  console.log(`[desktop-clean] Killed stale processes: ${killed.join(", ")}`);
}
if (failed.length > 0) {
  console.warn(`[desktop-clean] Failed to kill processes: ${failed.join(", ")}`);
}

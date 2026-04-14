import { execSync } from "node:child_process";

/** Vite dev server range used by desktop-media (no Next.js apps in this repo). */
const DEV_PORTS = Array.from({ length: 24 }, (_, index) => 5173 + index);

function unique(values) {
  return [...new Set(values)];
}

function getListeningPidsWindows(port) {
  // Prefer Get-NetTCPConnection to reliably capture IPv4/IPv6 listeners.
  try {
    const psOutput = execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"`,
      { encoding: "utf8" },
    );
    const pids = unique(
      psOutput
        .split(/\r?\n/)
        .map((line) => Number(line.trim()))
        .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid),
    );
    if (pids.length > 0) {
      return pids;
    }
  } catch {
    // Fall back to netstat parsing below.
  }

  try {
    const output = execSync(`netstat -ano -p tcp | findstr :${port}`, { encoding: "utf8" });
    return unique(
      output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && line.includes("LISTENING"))
        .map((line) => {
          const match = line.match(/(\d+)\s*$/);
          return match ? Number(match[1]) : null;
        })
        .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid),
    );
  } catch {
    return [];
  }
}

function getListeningPidsUnix(port) {
  try {
    const output = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, { encoding: "utf8" });
    return unique(
      output
        .split(/\r?\n/)
        .map((line) => Number(line.trim()))
        .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid),
    );
  } catch {
    return [];
  }
}

function killPid(pid) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}

const pidsToKill = unique(
  DEV_PORTS.flatMap((port) =>
    process.platform === "win32" ? getListeningPidsWindows(port) : getListeningPidsUnix(port),
  ),
);

if (pidsToKill.length === 0) {
  console.log("[dev-ports] No stale dev listeners found.");
  process.exit(0);
}

const killed = pidsToKill.filter(killPid);
const failed = pidsToKill.filter((pid) => !killed.includes(pid));

if (killed.length > 0) {
  console.log(`[dev-ports] Killed stale PIDs: ${killed.join(", ")}`);
}
if (failed.length > 0) {
  console.warn(`[dev-ports] Failed to kill PIDs: ${failed.join(", ")}`);
}

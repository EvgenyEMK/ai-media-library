/**
 * Rebuild native Node addons for the Electron version in this package (not system Node).
 * better-sqlite3: compile from source for reliable Electron ABI match.
 * onnxruntime-node: use prebuilds where available (avoid full source compile).
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(__dirname, "..");
const require = createRequire(import.meta.url);
const electronVersion = require("electron/package.json").version;

const isWindows = process.platform === "win32";
const pnpmCmd = isWindows ? "pnpm.cmd" : "pnpm";

function runElectronRebuild(extraArgs) {
  const args = ["exec", "electron-rebuild", "-f", ...extraArgs, "--version", electronVersion];
  const result = isWindows
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", [pnpmCmd, ...args].join(" ")], {
        cwd: pkgRoot,
        stdio: "inherit",
        env: process.env,
      })
    : spawnSync(pnpmCmd, args, {
        cwd: pkgRoot,
        stdio: "inherit",
        env: process.env,
      });
  if (result.error) {
    throw result.error;
  }
  return result.status ?? 0;
}

const sqliteStatus = runElectronRebuild(["--build-from-source", "-w", "better-sqlite3"]);
if (sqliteStatus !== 0) {
  process.exit(sqliteStatus);
}

const onnxStatus = runElectronRebuild(["-w", "onnxruntime-node"]);
process.exit(onnxStatus);

import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { setTimeout as sleep } from "node:timers/promises";
import { spawn } from "node:child_process";

const cwd = process.cwd();
const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const distElectronDir = path.join(cwd, "dist-electron");
const distMain = path.join(cwd, "dist-electron", "main.js");
const viteCacheDir = path.join(cwd, "node_modules", ".vite");
const defaultRendererPort = 5174;
const configuredRendererPort = process.env.EMK_DESKTOP_RENDERER_PORT?.trim();
const parsedConfiguredPort = configuredRendererPort ? Number.parseInt(configuredRendererPort, 10) : null;
const preferredRendererPort =
  parsedConfiguredPort !== null &&
  Number.isInteger(parsedConfiguredPort) &&
  parsedConfiguredPort > 0 &&
  parsedConfiguredPort < 65_536
    ? parsedConfiguredPort
    : defaultRendererPort;
let rendererPort = defaultRendererPort;
let rendererUrl = `http://localhost:${rendererPort}`;
const children = [];

if (configuredRendererPort && preferredRendererPort === defaultRendererPort) {
  console.warn(
    `[desktop-media dev] Invalid EMK_DESKTOP_RENDERER_PORT="${configuredRendererPort}". Falling back to ${defaultRendererPort}.`,
  );
}

function runPnpm(args, extraEnv = {}) {
  const isWindows = process.platform === "win32";
  if (isWindows) {
    const child = spawn("cmd.exe", ["/d", "/s", "/c", [pnpmCmd, ...args].join(" ")], {
      cwd,
      stdio: "inherit",
      env: { ...process.env, ...extraEnv },
    });
    children.push(child);
    return child;
  }
  const child = spawn(pnpmCmd, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv },
  });
  children.push(child);
  return child;
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
}

function isPortInUseOnHost(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        resolve(true);
        return;
      }
      resolve(false);
    });
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen({ port, host });
  });
}

async function isPortInUse(port) {
  const [busyV4, busyV6] = await Promise.all([
    isPortInUseOnHost(port, "127.0.0.1"),
    isPortInUseOnHost(port, "::1"),
  ]);
  return busyV4 || busyV6;
}

async function waitForRendererServer(url, timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch {
      // Server is not ready yet.
    }
    await sleep(500);
  }
  return false;
}

async function resolveRendererPort(startPort, maxTries = 20) {
  let currentPort = startPort;
  for (let attempt = 0; attempt < maxTries; attempt += 1) {
    const busy = await isPortInUse(currentPort);
    if (!busy) {
      return currentPort;
    }
    currentPort += 1;
  }
  return null;
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", shutdown);

// Avoid launching Electron with stale outputs from a previous run.
try {
  fs.rmSync(distElectronDir, { recursive: true, force: true });
  fs.rmSync(viteCacheDir, { recursive: true, force: true });
} catch {
  // Non-fatal cleanup best effort.
}

runPnpm(["exec", "vite", "build", "--config", "vite.main.config.ts", "--watch"]);

const availableRendererPort = await resolveRendererPort(preferredRendererPort);
if (availableRendererPort === null) {
  console.error(
    `[desktop-media dev] Could not find a free renderer port in range ${preferredRendererPort}-${preferredRendererPort + 19}.`,
  );
  process.exit(1);
}
rendererPort = availableRendererPort;
rendererUrl = `http://localhost:${rendererPort}`;

if (rendererPort !== preferredRendererPort) {
  console.warn(
    `[desktop-media dev] Port ${preferredRendererPort} is busy. Using ${rendererPort} instead.`,
  );
}

runPnpm([
  "exec",
  "vite",
  "--config",
  "vite.renderer.config.ts",
  "--force",
  "--port",
  String(rendererPort),
]);

while (!fs.existsSync(distMain)) {
  await sleep(500);
}

const rendererReady = await waitForRendererServer(rendererUrl);
if (!rendererReady) {
  console.error(
    `[desktop-media dev] Renderer server not reachable at ${rendererUrl}. Aborting Electron launch to avoid empty window.`,
  );
  shutdown();
  process.exit(1);
}

const electron = runPnpm(
  ["exec", "electron", "dist-electron/main.js"],
  { VITE_DEV_SERVER_URL: rendererUrl },
);

electron.on("exit", () => {
  shutdown();
  process.exit(0);
});

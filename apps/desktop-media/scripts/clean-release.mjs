import fs from "node:fs/promises";
import path from "node:path";

const appRoot = path.resolve(import.meta.dirname, "..");
const releaseDir = path.join(appRoot, "release");

async function readWindowsInstallerBasenames() {
  const [pkgRaw, builderRaw] = await Promise.all([
    fs.readFile(path.join(appRoot, "package.json"), "utf8"),
    fs.readFile(path.join(appRoot, "electron-builder.yml"), "utf8"),
  ]);
  const { version } = JSON.parse(pkgRaw);
  const productMatch = builderRaw.match(/^productName:\s*(.+)$/m);
  if (!productMatch) {
    throw new Error("electron-builder.yml: missing productName");
  }
  const productName = productMatch[1].trim().replace(/^["']|["']$/g, "");
  const exeName = `${productName}-${version}-Windows-x64.exe`;
  return { exeName, blockmapName: `${exeName}.blockmap` };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeWithRetries(targetPath, { maxAttempts = 40, required = true } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await fs.rm(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        if (required) {
          throw error;
        }
        return;
      }

      const code = error && typeof error === "object" ? error.code : undefined;
      if (code !== "EPERM" && code !== "EBUSY") {
        throw error;
      }

      await sleep(500 * attempt);
    }
  }

  if (!required) {
    return;
  }
}

const lockedAsarPath = path.join(releaseDir, "win-unpacked", "resources", "app.asar");
await removeWithRetries(lockedAsarPath, { required: false, maxAttempts: 3 });
await removeWithRetries(path.join(releaseDir, "win-unpacked"), { required: false, maxAttempts: 3 });
await removeWithRetries(path.join(releaseDir, "artifacts"));

const { exeName, blockmapName } = await readWindowsInstallerBasenames();
await removeWithRetries(path.join(releaseDir, exeName), { required: false });
await removeWithRetries(path.join(releaseDir, blockmapName), { required: false });

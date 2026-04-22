import fs from "node:fs/promises";
import path from "node:path";

const releaseDir = path.resolve(import.meta.dirname, "..", "release");

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
await removeWithRetries(path.join(releaseDir, "EMK Desktop Media-0.1.0-Windows-x64.exe"), {
  required: false,
});
await removeWithRetries(path.join(releaseDir, "EMK Desktop Media-0.1.0-Windows-x64.exe.blockmap"), {
  required: false,
});

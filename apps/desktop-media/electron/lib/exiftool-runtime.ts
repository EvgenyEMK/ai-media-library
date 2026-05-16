import fs from "node:fs";
import path from "node:path";
import { ExifTool, exiftoolPath as resolveDefaultExifToolPath } from "exiftool-vendored";

function packagedExifToolBinaryPath(): string | null {
  if (!process.resourcesPath) {
    return null;
  }

  const vendorPackageName =
    process.platform === "win32" ? "exiftool-vendored.exe" : "exiftool-vendored.pl";
  const executableName = process.platform === "win32" ? "exiftool.exe" : "exiftool";
  const candidate = path.join(
    process.resourcesPath,
    "app.asar.unpacked",
    "node_modules",
    vendorPackageName,
    "bin",
    executableName,
  );

  return fs.existsSync(candidate) ? candidate : null;
}

async function resolveExifToolBinaryPath(): Promise<string> {
  const packagedPath = packagedExifToolBinaryPath();
  if (packagedPath) {
    return packagedPath;
  }
  return resolveDefaultExifToolPath();
}

export const exiftool = new ExifTool({
  exiftoolPath: resolveExifToolBinaryPath,
});

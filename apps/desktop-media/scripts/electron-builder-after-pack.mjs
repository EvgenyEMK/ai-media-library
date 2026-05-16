import fs from "node:fs/promises";
import path from "node:path";
import { rcedit } from "rcedit";

async function removePath(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function removeMatchingFiles(rootDir, matcher) {
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (matcher(entry.name)) {
        await fs.rm(fullPath, { force: true });
      }
    }
  }
}

async function containsFileMatching(rootDir, matcher) {
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (matcher(entry.name)) {
        return true;
      }
    }
  }
  return false;
}

function unpackedNodeModulesPath(appOutDir) {
  return path.join(appOutDir, "resources", "app.asar.unpacked", "node_modules");
}

function exifToolPackageNames(platformName) {
  return {
    vendorPackageName: platformName === "win32" ? "exiftool-vendored.exe" : "exiftool-vendored.pl",
    executableName: platformName === "win32" ? "exiftool.exe" : "exiftool",
  };
}

async function findPnpmPackageRoot(projectDir, packageName) {
  const candidates = [
    path.join(projectDir, "node_modules", packageName),
    path.join(projectDir, "node_modules", "exiftool-vendored", "node_modules", packageName),
  ];
  const monorepoPnpmRoot = path.resolve(projectDir, "..", "..", "node_modules", ".pnpm");
  let entries = [];
  try {
    entries = await fs.readdir(monorepoPnpmRoot, { withFileTypes: true });
  } catch {
    entries = [];
  }
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith(`${packageName}@`)) {
      candidates.push(path.join(monorepoPnpmRoot, entry.name, "node_modules", packageName));
    }
  }

  for (const candidate of candidates) {
    if (await pathExists(path.join(candidate, "package.json"))) {
      return candidate;
    }
  }
  return null;
}

async function pruneOnnxForWindowsPack(unpackedRoot) {
  const onnxRoot = path.join(unpackedRoot, "onnxruntime-node", "bin", "napi-v3");
  await removePath(path.join(onnxRoot, "darwin"));
  await removePath(path.join(onnxRoot, "linux"));
  await removePath(path.join(onnxRoot, "win32", "arm64"));
}

async function pruneOnnxForLinuxPack(unpackedRoot) {
  const onnxRoot = path.join(unpackedRoot, "onnxruntime-node", "bin", "napi-v3");
  await removePath(path.join(onnxRoot, "darwin"));
  await removePath(path.join(onnxRoot, "win32"));
  await removePath(path.join(onnxRoot, "linux", "arm64"));
}

async function pruneBetterSqliteBuildArtifacts(unpackedRoot) {
  const betterSqliteBuildPath = path.join(unpackedRoot, "better-sqlite3", "build");
  await removeMatchingFiles(
    betterSqliteBuildPath,
    (fileName) =>
      fileName.endsWith(".iobj") ||
      fileName.endsWith(".ipdb") ||
      fileName.endsWith(".pdb") ||
      fileName.endsWith(".lib") ||
      fileName.endsWith(".o"),
  );
  await removePath(path.join(betterSqliteBuildPath, "Release", "obj"));
  await removePath(path.join(betterSqliteBuildPath, "Debug", "obj"));
}

async function assertLinuxSharpLibvipsUnpacked(unpackedRoot) {
  const libvipsPackageRoot = path.join(unpackedRoot, "@img", "sharp-libvips-linux-x64");
  if (!(await pathExists(libvipsPackageRoot))) {
    throw new Error(
      `Missing Sharp libvips runtime package in app.asar.unpacked: ${libvipsPackageRoot}`,
    );
  }

  const hasLibvips = await containsFileMatching(
    libvipsPackageRoot,
    (fileName) => fileName.startsWith("libvips-cpp.so"),
  );
  if (!hasLibvips) {
    throw new Error(
      `Missing libvips-cpp.so in Sharp libvips runtime package: ${libvipsPackageRoot}`,
    );
  }
}

async function assertExifToolBinaryUnpacked(unpackedRoot, platformName) {
  const { vendorPackageName, executableName } = exifToolPackageNames(platformName);
  const binaryPath = path.join(unpackedRoot, vendorPackageName, "bin", executableName);
  if (!(await pathExists(binaryPath))) {
    throw new Error(
      `Missing ExifTool runtime binary in app.asar.unpacked: ${binaryPath}`,
    );
  }
}

async function ensureExifToolBinaryUnpacked(context, unpackedRoot) {
  const { vendorPackageName, executableName } = exifToolPackageNames(context.electronPlatformName);
  const binaryPath = path.join(unpackedRoot, vendorPackageName, "bin", executableName);
  if (await pathExists(binaryPath)) {
    return;
  }

  const sourceRoot = await findPnpmPackageRoot(context.packager.projectDir, vendorPackageName);
  if (!sourceRoot) {
    throw new Error(
      `Missing ExifTool package ${vendorPackageName}. Run pnpm install for this platform, then rebuild.`,
    );
  }

  await fs.mkdir(unpackedRoot, { recursive: true });
  await fs.cp(sourceRoot, path.join(unpackedRoot, vendorPackageName), {
    recursive: true,
    force: true,
    dereference: true,
  });
}

async function embedWindowsExecutableIcon(context) {
  const productFilename = context.packager?.appInfo?.productFilename;
  if (!productFilename) {
    throw new Error("Unable to resolve product filename for Windows executable icon embedding.");
  }

  const exePath = path.join(context.appOutDir, `${productFilename}.exe`);
  const iconPath = path.join(context.packager.projectDir, "build-resources", "app-icon.ico");
  await rcedit(exePath, { icon: iconPath });
}

export default async function afterPack(context) {
  const isX64Arch = context.arch === 1 || context.arch === "x64";
  const unpackedRoot = unpackedNodeModulesPath(context.appOutDir);

  if (context.electronPlatformName === "win32" && isX64Arch) {
    await embedWindowsExecutableIcon(context);
    await ensureExifToolBinaryUnpacked(context, unpackedRoot);
    await assertExifToolBinaryUnpacked(unpackedRoot, context.electronPlatformName);
    await pruneOnnxForWindowsPack(unpackedRoot);
    await pruneBetterSqliteBuildArtifacts(unpackedRoot);
    return;
  }

  if (context.electronPlatformName === "linux" && isX64Arch) {
    await ensureExifToolBinaryUnpacked(context, unpackedRoot);
    await assertExifToolBinaryUnpacked(unpackedRoot, context.electronPlatformName);
    await pruneOnnxForLinuxPack(unpackedRoot);
    await pruneBetterSqliteBuildArtifacts(unpackedRoot);
    await assertLinuxSharpLibvipsUnpacked(unpackedRoot);
  }
}

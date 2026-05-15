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
    await pruneOnnxForWindowsPack(unpackedRoot);
    await pruneBetterSqliteBuildArtifacts(unpackedRoot);
    return;
  }

  if (context.electronPlatformName === "linux" && isX64Arch) {
    await pruneOnnxForLinuxPack(unpackedRoot);
    await pruneBetterSqliteBuildArtifacts(unpackedRoot);
    await assertLinuxSharpLibvipsUnpacked(unpackedRoot);
  }
}

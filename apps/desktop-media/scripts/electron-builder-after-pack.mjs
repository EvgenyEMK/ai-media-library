import fs from "node:fs/promises";
import path from "node:path";

async function removePath(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
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

export default async function afterPack(context) {
  const isX64Arch = context.arch === 1 || context.arch === "x64";
  if (context.electronPlatformName !== "win32" || !isX64Arch) {
    return;
  }

  const unpackedNodeModulesPath = path.join(
    context.appOutDir,
    "resources",
    "app.asar.unpacked",
    "node_modules",
  );

  const onnxRoot = path.join(unpackedNodeModulesPath, "onnxruntime-node", "bin", "napi-v3");
  await removePath(path.join(onnxRoot, "darwin"));
  await removePath(path.join(onnxRoot, "linux"));
  await removePath(path.join(onnxRoot, "win32", "arm64"));

  const betterSqliteBuildPath = path.join(unpackedNodeModulesPath, "better-sqlite3", "build");
  await removeMatchingFiles(
    betterSqliteBuildPath,
    (fileName) =>
      fileName.endsWith(".iobj") ||
      fileName.endsWith(".ipdb") ||
      fileName.endsWith(".pdb") ||
      fileName.endsWith(".lib"),
  );
  await removePath(path.join(betterSqliteBuildPath, "Release", "obj"));
}

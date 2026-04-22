import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const releaseDir = path.join(projectRoot, "release");
const unpackedCandidates = [
  path.join(releaseDir, "artifacts", "win-unpacked"),
  path.join(releaseDir, "win-unpacked"),
];
const unpackedRoot = unpackedCandidates.find((candidate) => fs.existsSync(candidate));

function walkFiles(root) {
  const files = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else {
        files.push({ path: fullPath, size: fs.statSync(fullPath).size });
      }
    }
  }

  return files;
}

function toMb(bytes) {
  return bytes / (1024 * 1024);
}

if (!unpackedRoot) {
  console.error(`Missing unpacked release directory. Checked: ${unpackedCandidates.join(", ")}`);
  process.exit(1);
}

const files = walkFiles(unpackedRoot).sort((a, b) => b.size - a.size);
const topN = files.slice(0, 20);

console.log("Top 20 largest files in win-unpacked:");
for (const entry of topN) {
  const relative = path.relative(projectRoot, entry.path);
  console.log(`${toMb(entry.size).toFixed(2).padStart(8)} MB  ${relative}`);
}

const exeCandidates = fs
  .readdirSync(releaseDir, { withFileTypes: true })
  .flatMap((entry) => {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".exe")) {
      const fullPath = path.join(releaseDir, entry.name);
      return [{ name: path.relative(projectRoot, fullPath), size: fs.statSync(fullPath).size }];
    }

    if (entry.isDirectory()) {
      const subDir = path.join(releaseDir, entry.name);
      return fs
        .readdirSync(subDir, { withFileTypes: true })
        .filter((subEntry) => subEntry.isFile() && subEntry.name.toLowerCase().endsWith(".exe"))
        .map((subEntry) => {
          const fullPath = path.join(subDir, subEntry.name);
          return {
            name: path.relative(projectRoot, fullPath),
            size: fs.statSync(fullPath).size,
          };
        });
    }

    return [];
  })
  .sort((a, b) => b.size - a.size);

if (exeCandidates.length === 0) {
  console.warn("No .exe found in release directory.");
  process.exit(0);
}

const largestExe = exeCandidates[0];
const exeMb = toMb(largestExe.size);
console.log(`\nLargest installer: ${largestExe.name} (${exeMb.toFixed(2)} MB)`);

const maxExeMb = Number(process.env.MAX_EXE_MB ?? 0);
if (Number.isFinite(maxExeMb) && maxExeMb > 0 && exeMb > maxExeMb) {
  console.error(`Installer exceeds MAX_EXE_MB=${maxExeMb}: got ${exeMb.toFixed(2)} MB`);
  process.exit(2);
}

import path from "node:path";

/** Match a `folder_analysis_status.folder_path` (or similar) row to a path from the filesystem / IPC. */
export function folderPathMatchesStored(dbPath: string, requested: string): boolean {
  const a = path.normalize(dbPath.trim());
  const b = path.normalize(requested.trim());
  if (a === b) return true;
  if (process.platform === "win32" && a.toLowerCase() === b.toLowerCase()) return true;
  const altA = a.includes("\\") ? a.replace(/\\/g, "/") : a.replace(/\//g, "\\");
  if (altA === b) return true;
  if (process.platform === "win32" && altA.toLowerCase() === b.toLowerCase()) return true;
  return false;
}

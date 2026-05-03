import path from "node:path";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import type { FolderTreeQuickScanMoveItem, QuickScanMovedFileMatchMode } from "../../src/shared/ipc";

const MAX_HASH_BYTES = 128 * 1024 * 1024;

export interface PendingDeletedCatalog {
  sourcePath: string;
  folderPath: string;
  filename: string;
  byteSize: number | null;
  contentHash: string | null;
}

export interface PendingNewDisk {
  path: string;
  folderPath: string;
  filename: string;
  byteSize: number;
}

async function sha256FileHex(filePath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    let read = 0;
    stream.on("error", () => resolve(null));
    stream.on("data", (chunk: Buffer) => {
      read += chunk.length;
      if (read > MAX_HASH_BYTES) {
        stream.destroy();
        resolve(null);
        return;
      }
      hash.update(chunk);
    });
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

function sameNameSize(a: PendingDeletedCatalog, b: PendingNewDisk): boolean {
  if (a.byteSize == null) return false;
  return (
    a.filename.toLowerCase() === b.filename.toLowerCase() &&
    b.byteSize === a.byteSize
  );
}

function nameSizeMatchCandidate(d: PendingDeletedCatalog, n: PendingNewDisk): boolean {
  return sameNameSize(d, n);
}

function hashMatchCandidate(d: PendingDeletedCatalog, n: PendingNewDisk): boolean {
  if (!d.contentHash || d.contentHash.length === 0 || d.byteSize == null || d.byteSize > MAX_HASH_BYTES) {
    return false;
  }
  return (
    n.filename.toLowerCase() === d.filename.toLowerCase() &&
    n.byteSize === d.byteSize &&
    n.byteSize <= MAX_HASH_BYTES
  );
}

/**
 * Pair catalog "deleted" paths with new disk paths under the scan tree (same basename + match rule).
 */
export async function pairQuickScanMoves(params: {
  pendingDeleted: PendingDeletedCatalog[];
  pendingNew: PendingNewDisk[];
  mode: QuickScanMovedFileMatchMode;
}): Promise<{
  moves: FolderTreeQuickScanMoveItem[];
  remainingDeleted: PendingDeletedCatalog[];
  remainingNew: PendingNewDisk[];
}> {
  const remainingDeleted = [...params.pendingDeleted];
  const remainingNew = [...params.pendingNew];
  const moves: FolderTreeQuickScanMoveItem[] = [];

  let i = 0;
  while (i < remainingDeleted.length) {
    const d = remainingDeleted[i]!;
    const predicate = params.mode === "name-size" ? nameSizeMatchCandidate : hashMatchCandidate;
    const j = remainingNew.findIndex((n) => predicate(d, n));
    if (j < 0) {
      i += 1;
      continue;
    }
    const n = remainingNew[j]!;
    if (params.mode === "content-hash") {
      const hash = await sha256FileHex(n.path);
      if (hash == null || hash !== d.contentHash) {
        i += 1;
        continue;
      }
    }
    moves.push({
      filename: d.filename,
      fromFolderPath: d.folderPath,
      toFolderPath: n.folderPath,
      previousPath: d.sourcePath,
      newPath: n.path,
    });
    remainingDeleted.splice(i, 1);
    remainingNew.splice(j, 1);
  }

  return { moves, remainingDeleted, remainingNew };
}

export function parentFolderForFilePath(filePath: string): string {
  return path.normalize(path.dirname(filePath));
}

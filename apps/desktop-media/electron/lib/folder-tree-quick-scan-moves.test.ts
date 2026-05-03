import { describe, expect, it } from "vitest";
import { pairQuickScanMoves, parentFolderForFilePath, type PendingDeletedCatalog, type PendingNewDisk } from "./folder-tree-quick-scan-moves";

describe("parentFolderForFilePath", () => {
  it("returns normalized parent directory", () => {
    expect(parentFolderForFilePath("C:\\a\\b\\c.jpg")).toBe("C:\\a\\b");
  });
});

describe("pairQuickScanMoves", () => {
  it("pairs same filename and size in name-size mode", async () => {
    const pendingDeleted: PendingDeletedCatalog[] = [
      {
        sourcePath: "C:\\lib\\a\\x.jpg",
        folderPath: "C:\\lib\\a",
        filename: "x.jpg",
        byteSize: 100,
        contentHash: null,
      },
    ];
    const pendingNew: PendingNewDisk[] = [
      {
        path: "C:\\lib\\b\\x.jpg",
        folderPath: "C:\\lib\\b",
        filename: "x.jpg",
        byteSize: 100,
      },
    ];
    const { moves, remainingDeleted, remainingNew } = await pairQuickScanMoves({
      pendingDeleted,
      pendingNew,
      mode: "name-size",
    });
    expect(moves).toHaveLength(1);
    expect(moves[0]?.previousPath).toBe("C:\\lib\\a\\x.jpg");
    expect(moves[0]?.newPath).toBe("C:\\lib\\b\\x.jpg");
    expect(remainingDeleted).toHaveLength(0);
    expect(remainingNew).toHaveLength(0);
  });

  it("does not pair when byte size differs in name-size mode", async () => {
    const pendingDeleted: PendingDeletedCatalog[] = [
      {
        sourcePath: "C:\\lib\\a\\x.jpg",
        folderPath: "C:\\lib\\a",
        filename: "x.jpg",
        byteSize: 100,
        contentHash: null,
      },
    ];
    const pendingNew: PendingNewDisk[] = [
      {
        path: "C:\\lib\\b\\x.jpg",
        folderPath: "C:\\lib\\b",
        filename: "x.jpg",
        byteSize: 200,
      },
    ];
    const { moves, remainingDeleted, remainingNew } = await pairQuickScanMoves({
      pendingDeleted,
      pendingNew,
      mode: "name-size",
    });
    expect(moves).toHaveLength(0);
    expect(remainingDeleted).toHaveLength(1);
    expect(remainingNew).toHaveLength(1);
  });
});

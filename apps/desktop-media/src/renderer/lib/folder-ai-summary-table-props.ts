import type { FolderAiCoverageReport, FolderFaceSummaryStreamRowSpec } from "../../shared/ipc";
import {
  FOLDER_FACE_SUMMARY_STREAM_ROW_IDS,
  FOLDER_FACE_SUMMARY_SUBFOLDER_ROW_PREFIX,
} from "../../shared/ipc";

export interface DerivedFolderAiSummaryTableProps {
  treeLayout: boolean;
  selectedWithSubfolders: FolderAiCoverageReport | undefined;
  selectedDirectOnly: FolderAiCoverageReport | undefined;
  subfolders: Array<{
    folderPath: string;
    name: string;
    coverage: FolderAiCoverageReport | undefined;
  }>;
}

export function deriveFolderAiSummaryTableProps(
  rowSpecs: FolderFaceSummaryStreamRowSpec[],
  coverageByRowId: Record<string, FolderAiCoverageReport>,
): DerivedFolderAiSummaryTableProps {
  if (rowSpecs.length === 1 && rowSpecs[0]?.rowId === FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.singleFolder) {
    const rowId = rowSpecs[0].rowId;
    return {
      treeLayout: false,
      selectedWithSubfolders: undefined,
      selectedDirectOnly: coverageByRowId[rowId],
      subfolders: [],
    };
  }

  const recursiveId = FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedRecursive;
  const directId = FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedDirect;
  const subfolderSpecs = rowSpecs.filter((s) => s.rowId.startsWith(FOLDER_FACE_SUMMARY_SUBFOLDER_ROW_PREFIX));

  return {
    treeLayout: true,
    selectedWithSubfolders: coverageByRowId[recursiveId],
    selectedDirectOnly: coverageByRowId[directId],
    subfolders: subfolderSpecs.map((s) => ({
      folderPath: s.folderPath,
      name: s.name,
      coverage: coverageByRowId[s.rowId],
    })),
  };
}

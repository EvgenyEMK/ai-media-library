export interface AutoMetadataScanPolicyInput {
  directMediaCount: number;
  childFolderCount: number;
  autoScanMaxFiles: number;
  hasRunningManualScan: boolean;
  suppressAutoMetadataScan?: boolean;
}

export function shouldRunAutoMetadataScan(input: AutoMetadataScanPolicyInput): boolean {
  if (input.suppressAutoMetadataScan === true) return false;
  if (input.hasRunningManualScan) return false;
  if (input.directMediaCount === 0 && input.childFolderCount > 0) return false;
  return input.directMediaCount < input.autoScanMaxFiles;
}

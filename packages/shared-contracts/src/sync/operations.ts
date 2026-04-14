import type { MediaId, MediaLibraryId, MediaRecord } from "../domain/media";

export type SyncOperationType =
  | "media.upsert"
  | "media.delete"
  | "media.tag.add"
  | "media.tag.remove"
  | "media.ai.annotate"
  | "media.source.add"
  | "media.source.remove";

export interface SyncOperation {
  operationId: string;
  libraryId: MediaLibraryId;
  mediaId: MediaId;
  type: SyncOperationType;
  occurredAt: string;
  actorId: string;
  payload: Record<string, unknown>;
}

export interface SyncCheckpoint {
  libraryId: MediaLibraryId;
  lastOperationId?: string;
  lastSyncedAt?: string;
}

export interface SyncBatch {
  checkpoint: SyncCheckpoint;
  operations: SyncOperation[];
}

export interface SyncConflict {
  operationId: string;
  reason:
    | "missing-base-record"
    | "version-mismatch"
    | "permission-denied"
    | "duplicate-operation";
  message: string;
}

export interface SyncApplyResult {
  acceptedOperationIds: string[];
  conflicts: SyncConflict[];
  updatedRecords: MediaRecord[];
}

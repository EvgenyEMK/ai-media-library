import { randomUUID } from "node:crypto";
import { getDesktopDatabase } from "./client";
import { DEFAULT_LIBRARY_ID } from "./folder-analysis-status";

type DesktopSyncOperationType =
  | "media.upsert"
  | "media.delete"
  | "media.ai.annotate"
  | "media.source.add"
  | "media.source.remove";

interface AppendSyncOperationParams {
  mediaId: string;
  operationType: DesktopSyncOperationType;
  payload: Record<string, unknown>;
  libraryId?: string;
  actorId?: string;
}

export function appendSyncOperation(params: AppendSyncOperationParams): void {
  const db = getDesktopDatabase();
  const occurredAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO sync_operation_log (
      operation_id,
      library_id,
      media_id,
      operation_type,
      actor_id,
      occurred_at,
      payload_json,
      sync_status,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
  ).run(
    randomUUID(),
    params.libraryId ?? DEFAULT_LIBRARY_ID,
    params.mediaId,
    params.operationType,
    params.actorId ?? "desktop-local",
    occurredAt,
    JSON.stringify(params.payload),
    occurredAt,
  );
}

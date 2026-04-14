import { MediaApiClient } from "@emk/sdk-media-api";
import type { AiProviderAdapter, MediaRecord, SyncBatch } from "@emk/shared-contracts";

export interface DesktopContractWiring {
  mediaClient: MediaApiClient;
  aiAdapter: AiProviderAdapter;
  createSyncBatch: (records: MediaRecord[]) => SyncBatch;
}

export function createDesktopContractWiring(
  apiBaseUrl: string,
  aiAdapter: AiProviderAdapter,
): DesktopContractWiring {
  const mediaClient = new MediaApiClient({ baseUrl: apiBaseUrl });

  return {
    mediaClient,
    aiAdapter,
    createSyncBatch(records) {
      const operations = records.map((record) => ({
        operationId: crypto.randomUUID(),
        libraryId: record.libraryId,
        mediaId: record.identity.mediaId,
        type: "media.upsert" as const,
        occurredAt: new Date().toISOString(),
        actorId: "desktop-client",
        payload: { record },
      }));

      return {
        checkpoint: { libraryId: records[0]?.libraryId ?? "default" },
        operations,
      };
    },
  };
}

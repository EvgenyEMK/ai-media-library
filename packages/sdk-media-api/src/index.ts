import type { SyncBatch } from "@emk/shared-contracts";

export interface MediaApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null>;
}

export interface SyncResult {
  success: boolean;
  message?: string;
}

export class MediaApiClient {
  private readonly baseUrl: string;
  private readonly getAccessToken?: () => Promise<string | null>;

  constructor(options: MediaApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.getAccessToken = options.getAccessToken;
  }

  async pushSyncBatch(batch: SyncBatch): Promise<SyncResult> {
    const token = this.getAccessToken ? await this.getAccessToken() : null;

    const response = await fetch(`${this.baseUrl}/api/media/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        message: errorText || `Sync failed with status ${response.status}`,
      };
    }

    return { success: true };
  }
}

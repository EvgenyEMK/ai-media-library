import { ipcMain } from "electron";
import {
  IPC_CHANNELS,
  type ApplyWrongRotationToMediaItemRequest,
  type DismissWrongRotationSuggestionRequest,
  type RotationReviewMutationResult,
} from "../../src/shared/ipc";
import {
  applyWrongRotationToMediaItem,
  dismissWrongRotationSuggestion,
} from "../db/rotation-review-mutations";

function parseMediaItemId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseQuarterTurn(value: unknown): 90 | 180 | 270 | null {
  return value === 90 || value === 180 || value === 270 ? value : null;
}

export function registerRotationReviewHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.applyWrongRotationToMediaItem,
    async (_event, request: ApplyWrongRotationToMediaItemRequest): Promise<RotationReviewMutationResult> => {
      const mediaItemId = parseMediaItemId(request?.mediaItemId);
      const angleClockwise = parseQuarterTurn(request?.angleClockwise);
      if (!mediaItemId) return { success: false, error: "mediaItemId is required." };
      if (!angleClockwise) return { success: false, error: "angleClockwise must be 90, 180, or 270." };
      return applyWrongRotationToMediaItem({ mediaItemId, angleClockwise });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.dismissWrongRotationSuggestion,
    async (_event, request: DismissWrongRotationSuggestionRequest): Promise<RotationReviewMutationResult> => {
      const mediaItemId = parseMediaItemId(request?.mediaItemId);
      if (!mediaItemId) return { success: false, error: "mediaItemId is required." };
      return dismissWrongRotationSuggestion({ mediaItemId });
    },
  );
}

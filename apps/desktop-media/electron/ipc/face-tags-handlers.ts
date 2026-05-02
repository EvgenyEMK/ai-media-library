import { randomUUID } from "node:crypto";
import { BrowserWindow, ipcMain } from "electron";
import { IPC_CHANNELS } from "../../src/shared/ipc";
import { getDesktopDatabase } from "../db/client";
import { DEFAULT_LIBRARY_ID } from "../db/folder-analysis-status";
import {
  assignPersonTagToFaceInstance,
  assignPersonTagsToFaceInstances,
  clearPersonTagFromFaceInstance,
  countTaggedFacesForPerson,
  createPersonTag,
  deleteFaceInstance,
  deletePersonTag,
  getFaceCropPathsByIds,
  getFaceInfoByIds,
  getPersonTagDeleteUsage,
  listFaceInstancesByMediaItem,
  listFacesTaggedForPerson,
  listPersonTags,
  listPersonTagsWithFaceCounts,
  setPersonTagPinned,
  updatePersonTagBirthDate,
  updatePersonTagLabel,
} from "../db/face-tags";
import {
  countSimilarUntaggedFacesForPerson,
  recomputeAndStoreCentroid,
} from "../db/face-embeddings";
import { getSimilarUntaggedFaceCountsForTags } from "../db/face-similar-counts-batch";
import { getEmbeddingModelInfo } from "../face-embedding";
import { deleteFaceCropById } from "../face-crop";
import { getFaceRecognitionSimilarityThreshold } from "../face-recognition-threshold";
import { refreshSuggestionsForTag, clearSuggestionsForMediaItemTag } from "../db/person-suggestions";
import { EARLY_SUGGESTION_REFRESH_MAX_TAGGED_FACES } from "../person-suggestion-refresh-policy";
import {
  createPersonGroup,
  deletePersonGroup,
  getPersonTagGroupsMap,
  listPersonGroups,
  listPersonTagsInGroup,
  renamePersonGroup,
  setPersonTagGroups,
} from "../db/person-groups";

async function finalizePersonTagAssignments(
  tagId: string,
  affectedMediaItemIds: string[],
): Promise<void> {
  const modelInfo = await getEmbeddingModelInfo();
  if (modelInfo) {
    recomputeAndStoreCentroid(tagId, modelInfo.modelName, modelInfo.dimension);
  }
  for (const mediaItemId of affectedMediaItemIds) {
    clearSuggestionsForMediaItemTag(mediaItemId, tagId);
  }
  const taggedCount = countTaggedFacesForPerson(tagId);
  if (taggedCount < EARLY_SUGGESTION_REFRESH_MAX_TAGGED_FACES) {
    const suggestionThreshold = await getFaceRecognitionSimilarityThreshold();
    refreshSuggestionsForTag(tagId, { threshold: suggestionThreshold });
  }
}

const similarUntaggedCountsJobs = new Map<string, { cancelled: boolean }>();

export function registerFaceTagsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.listPersonTags, async () => {
    return listPersonTags();
  });

  ipcMain.handle(IPC_CHANNELS.listPersonTagsWithFaceCounts, async () => {
    return listPersonTagsWithFaceCounts();
  });

  ipcMain.handle(
    IPC_CHANNELS.getSimilarUntaggedFaceCountsForTags,
    async (
      _event,
      request: { tagIds: string[]; threshold?: number },
    ) => {
      const ids = Array.isArray(request.tagIds) ? request.tagIds : [];
      const threshold =
        request.threshold ?? (await getFaceRecognitionSimilarityThreshold());
      return getSimilarUntaggedFaceCountsForTags(ids, { threshold });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.startSimilarUntaggedFaceCountsJob,
    async (
      event,
      request: { tagIds: string[]; threshold?: number },
    ): Promise<{ jobId: string }> => {
      const jobId = randomUUID();
      similarUntaggedCountsJobs.set(jobId, { cancelled: false });
      const win = BrowserWindow.fromWebContents(event.sender);
      const tagIds = Array.from(
        new Set((Array.isArray(request.tagIds) ? request.tagIds : []).filter(Boolean)),
      );
      const threshold =
        request.threshold ?? (await getFaceRecognitionSimilarityThreshold());

      void (async () => {
        const send = (payload: unknown) => {
          win?.webContents.send(IPC_CHANNELS.similarUntaggedCountsProgress, payload);
        };
        try {
          send({
            type: "job-started",
            jobId,
            total: tagIds.length,
            tagIds,
          });
          const out: Record<string, number> = {};
          for (let i = 0; i < tagIds.length; i++) {
            // Yield so ipcMain cancel handler can run (countSimilarUntaggedFacesForPerson is synchronous).
            await new Promise<void>((resolve) => {
              setImmediate(resolve);
            });
            if (similarUntaggedCountsJobs.get(jobId)?.cancelled) {
              send({ type: "job-cancelled", jobId });
              return;
            }
            const tid = tagIds[i];
            out[tid] = countSimilarUntaggedFacesForPerson(tid, { threshold });
            send({
              type: "progress",
              jobId,
              processed: i + 1,
              total: tagIds.length,
              counts: { ...out },
            });
          }
          if (similarUntaggedCountsJobs.get(jobId)?.cancelled) {
            send({ type: "job-cancelled", jobId });
            return;
          }
          send({ type: "job-completed", jobId, counts: out });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Similar face counts failed.";
          send({ type: "job-failed", jobId, error: message });
        } finally {
          similarUntaggedCountsJobs.delete(jobId);
        }
      })();

      return { jobId };
    },
  );

  ipcMain.handle(IPC_CHANNELS.cancelSimilarUntaggedFaceCountsJob, (_event, jobId: string) => {
    const entry = similarUntaggedCountsJobs.get(jobId);
    if (entry) {
      entry.cancelled = true;
    }
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.listPersonGroups, async () => {
    return listPersonGroups();
  });

  ipcMain.handle(IPC_CHANNELS.createPersonGroup, async (_event, name: string) => {
    return createPersonGroup(name);
  });

  ipcMain.handle(
    IPC_CHANNELS.setPersonTagGroups,
    async (_event, tagId: string, groupIds: string[]) => {
      setPersonTagGroups(tagId, groupIds);
    },
  );

  ipcMain.handle(IPC_CHANNELS.getPersonTagGroupsForTagIds, async (_event, tagIds: string[]) => {
    return getPersonTagGroupsMap(tagIds);
  });

  ipcMain.handle(
    IPC_CHANNELS.updatePersonGroupName,
    async (_event, groupId: string, name: string) => {
      return renamePersonGroup(groupId, name);
    },
  );

  ipcMain.handle(IPC_CHANNELS.deletePersonGroup, async (_event, groupId: string) => {
    deletePersonGroup(groupId);
  });

  ipcMain.handle(IPC_CHANNELS.listPersonTagsInGroup, async (_event, groupId: string) => {
    return listPersonTagsInGroup(groupId);
  });

  ipcMain.handle(
    IPC_CHANNELS.createPersonTag,
    async (_event, label: string, birthDate?: string | null) => {
      return createPersonTag(label, DEFAULT_LIBRARY_ID, birthDate);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.updatePersonTagLabel,
    async (_event, tagId: string, label: string) => {
      return updatePersonTagLabel(tagId, label);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.updatePersonTagBirthDate,
    async (_event, tagId: string, birthDate: string | null) => {
      return updatePersonTagBirthDate(tagId, birthDate);
    },
  );

  ipcMain.handle(IPC_CHANNELS.getPersonTagDeleteUsage, async (_event, tagId: string) => {
    return getPersonTagDeleteUsage(tagId);
  });

  ipcMain.handle(IPC_CHANNELS.deletePersonTag, async (_event, tagId: string) => {
    return deletePersonTag(tagId);
  });

  ipcMain.handle(
    IPC_CHANNELS.setPersonTagPinned,
    async (_event, tagId: string, pinned: boolean) => {
      return setPersonTagPinned(tagId, Boolean(pinned));
    },
  );

  ipcMain.handle(IPC_CHANNELS.listFaceInstancesForMediaItem, async (_event, mediaItemId: string) => {
    return listFaceInstancesByMediaItem(mediaItemId);
  });

  ipcMain.handle(
    IPC_CHANNELS.assignPersonTagToFace,
    async (_event, faceInstanceId: string, tagId: string) => {
      const result = assignPersonTagToFaceInstance(faceInstanceId, tagId);
      if (result) {
        await finalizePersonTagAssignments(tagId, [result.media_item_id]);
      }
      return result;
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.assignPersonTagsToFaces,
    async (_event, faceInstanceIds: string[], tagId: string) => {
      const { assignedCount, affectedMediaItemIds } = assignPersonTagsToFaceInstances(
        faceInstanceIds,
        tagId,
      );
      if (assignedCount > 0) {
        await finalizePersonTagAssignments(tagId, affectedMediaItemIds);
      }
      return { assignedCount };
    },
  );

  ipcMain.handle(IPC_CHANNELS.refreshPersonSuggestionsForTag, async (_event, tagId: string) => {
    const suggestionThreshold = await getFaceRecognitionSimilarityThreshold();
    const count = refreshSuggestionsForTag(tagId, { threshold: suggestionThreshold });
    return { count };
  });

  ipcMain.handle(IPC_CHANNELS.recomputePersonCentroid, async (_event, tagId: string) => {
    const modelInfo = await getEmbeddingModelInfo();
    if (!modelInfo) {
      return { success: false as const, error: "Embedding model is not available." };
    }
    recomputeAndStoreCentroid(tagId, modelInfo.modelName, modelInfo.dimension);
    return { success: true as const };
  });

  ipcMain.handle(IPC_CHANNELS.clearPersonTagFromFace, async (_event, faceInstanceId: string) => {
    const db = getDesktopDatabase();
    const row = db
      .prepare("SELECT tag_id FROM media_face_instances WHERE id = ?")
      .get(faceInstanceId) as { tag_id: string | null } | undefined;
    const previousTagId = row?.tag_id ?? null;

    const result = clearPersonTagFromFaceInstance(faceInstanceId);

    if (previousTagId) {
      const modelInfo = await getEmbeddingModelInfo();
      if (modelInfo) {
        recomputeAndStoreCentroid(previousTagId, modelInfo.modelName, modelInfo.dimension);
      }
      const suggestionThreshold = await getFaceRecognitionSimilarityThreshold();
      refreshSuggestionsForTag(previousTagId, { threshold: suggestionThreshold });
    }

    return result;
  });

  ipcMain.handle(IPC_CHANNELS.deleteFaceInstance, async (_event, faceInstanceId: string) => {
    await deleteFaceCropById(faceInstanceId);
    return deleteFaceInstance(faceInstanceId);
  });

  ipcMain.handle(
    IPC_CHANNELS.getFaceCropPaths,
    async (_event, faceInstanceIds: string[]) => {
      return getFaceCropPathsByIds(faceInstanceIds);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.listFacesForPerson,
    async (_event, tagId: string) => {
      return listFacesTaggedForPerson(tagId);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.getFaceInfoByIds,
    async (_event, faceInstanceIds: string[]) => {
      return getFaceInfoByIds(faceInstanceIds);
    },
  );
}

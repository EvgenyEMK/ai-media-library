import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { DesktopPersonGroup } from "../../shared/ipc";

export function usePersonTagGroupActions(
  groupsByTagId: Record<string, DesktopPersonGroup[]>,
  setGroupsByTagId: Dispatch<SetStateAction<Record<string, DesktopPersonGroup[]>>>,
  setAllGroups: Dispatch<SetStateAction<DesktopPersonGroup[]>>,
  setErrorMessage: Dispatch<SetStateAction<string | null>>,
): {
  savingGroupTagId: string | null;
  handleAddGroup: (tagId: string, groupId: string) => Promise<void>;
  handleRemoveGroup: (tagId: string, groupId: string) => Promise<void>;
  handleCreateGroupForTag: (tagId: string, name: string) => Promise<void>;
} {
  const [savingGroupTagId, setSavingGroupTagId] = useState<string | null>(null);

  const handleAddGroup = useCallback(
    async (tagId: string, groupId: string) => {
      setSavingGroupTagId(tagId);
      setErrorMessage(null);
      try {
        const current = new Set((groupsByTagId[tagId] ?? []).map((g) => g.id));
        current.add(groupId);
        await window.desktopApi.setPersonTagGroups(tagId, Array.from(current));
        const map = await window.desktopApi.getPersonTagGroupsForTagIds([tagId]);
        setGroupsByTagId((prev) => ({
          ...prev,
          /** Map omits tagId when there are zero groups — must clear stale UI state. */
          [tagId]: map[tagId] ?? [],
        }));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to update groups.");
      } finally {
        setSavingGroupTagId(null);
      }
    },
    [groupsByTagId, setGroupsByTagId, setErrorMessage],
  );

  const handleRemoveGroup = useCallback(
    async (tagId: string, groupId: string) => {
      setSavingGroupTagId(tagId);
      setErrorMessage(null);
      try {
        const current = new Set((groupsByTagId[tagId] ?? []).map((g) => g.id));
        current.delete(groupId);
        await window.desktopApi.setPersonTagGroups(tagId, Array.from(current));
        const map = await window.desktopApi.getPersonTagGroupsForTagIds([tagId]);
        setGroupsByTagId((prev) => ({
          ...prev,
          [tagId]: map[tagId] ?? [],
        }));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to update groups.");
      } finally {
        setSavingGroupTagId(null);
      }
    },
    [groupsByTagId, setGroupsByTagId, setErrorMessage],
  );

  const handleCreateGroupForTag = useCallback(
    async (tagId: string, name: string) => {
      setSavingGroupTagId(tagId);
      setErrorMessage(null);
      try {
        const created = await window.desktopApi.createPersonGroup(name);
        setAllGroups((prev) => {
          const next = prev.filter((g) => g.id !== created.id);
          next.push(created);
          next.sort((a, b) => a.name.localeCompare(b.name));
          return next;
        });
        const current = new Set((groupsByTagId[tagId] ?? []).map((g) => g.id));
        current.add(created.id);
        await window.desktopApi.setPersonTagGroups(tagId, Array.from(current));
        const map = await window.desktopApi.getPersonTagGroupsForTagIds([tagId]);
        setGroupsByTagId((prev) => ({
          ...prev,
          [tagId]: map[tagId] ?? [],
        }));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to create group.");
      } finally {
        setSavingGroupTagId(null);
      }
    },
    [groupsByTagId, setAllGroups, setGroupsByTagId, setErrorMessage],
  );

  return {
    savingGroupTagId,
    handleAddGroup,
    handleRemoveGroup,
    handleCreateGroupForTag,
  };
}

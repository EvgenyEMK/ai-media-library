import { useCallback, useEffect, useState } from "react";
import type { DesktopPersonGroup, DesktopPersonTag } from "../../shared/ipc";
import type { DesktopPeopleGroupsTabState } from "./use-desktop-people-groups-tab-types";

const LOAD_ERROR = "Failed to load groups.";

export function useDesktopPeopleGroupsTab(): DesktopPeopleGroupsTabState {
  const [groups, setGroups] = useState<DesktopPersonGroup[]>([]);
  const [membersByGroupId, setMembersByGroupId] = useState<Record<string, DesktopPersonTag[]>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<DesktopPersonGroup | null>(null);

  const loadMembers = useCallback(async (list: DesktopPersonGroup[]) => {
    const entries = await Promise.all(
      list.map(async (g) => {
        const people = await window.desktopApi.listPersonTagsInGroup(g.id);
        return [g.id, people] as const;
      }),
    );
    const next: Record<string, DesktopPersonTag[]> = {};
    for (const [id, people] of entries) {
      next[id] = people;
    }
    setMembersByGroupId(next);
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const list = await window.desktopApi.listPersonGroups();
      setGroups(list);
      await loadMembers(list);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : LOAD_ERROR);
    } finally {
      setIsLoading(false);
    }
  }, [loadMembers]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRemovePersonFromGroup = useCallback(
    async (groupId: string, person: DesktopPersonTag) => {
      setSavingGroupId(groupId);
      setErrorMessage(null);
      try {
        const map = await window.desktopApi.getPersonTagGroupsForTagIds([person.id]);
        const currentIds = (map[person.id] ?? []).map((x) => x.id);
        const nextIds = currentIds.filter((id) => id !== groupId);
        await window.desktopApi.setPersonTagGroups(person.id, nextIds);
        const people = await window.desktopApi.listPersonTagsInGroup(groupId);
        setMembersByGroupId((prev) => ({ ...prev, [groupId]: people }));
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to remove person from group.",
        );
      } finally {
        setSavingGroupId(null);
      }
    },
    [],
  );

  const handleCreate = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setIsCreating(true);
    setErrorMessage(null);
    try {
      const created = await window.desktopApi.createPersonGroup(trimmed);
      setNewName("");
      setGroups((prev) => {
        const next = prev.filter((g) => g.id !== created.id);
        next.push(created);
        next.sort((a, b) => a.name.localeCompare(b.name));
        return next;
      });
      setMembersByGroupId((prev) => ({ ...prev, [created.id]: [] }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create group.");
    } finally {
      setIsCreating(false);
    }
  }, [newName]);

  const startEdit = useCallback((g: DesktopPersonGroup) => {
    setEditingGroupId(g.id);
    setDraftName(g.name);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingGroupId(null);
    setDraftName("");
  }, []);

  const saveEdit = useCallback(
    async (groupId: string) => {
      const trimmed = draftName.trim();
      if (!trimmed) return;
      setSavingGroupId(groupId);
      setErrorMessage(null);
      try {
        const updated = await window.desktopApi.updatePersonGroupName(groupId, trimmed);
        setGroups((current) =>
          current
            .map((g) => (g.id === groupId ? updated : g))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        setEditingGroupId(null);
        setDraftName("");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to rename group.");
      } finally {
        setSavingGroupId(null);
      }
    },
    [draftName],
  );

  const requestDelete = useCallback((group: DesktopPersonGroup) => {
    setPendingDeleteGroup(group);
  }, []);

  const cancelDelete = useCallback(() => {
    setPendingDeleteGroup(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    const groupId = pendingDeleteGroup?.id;
    if (!groupId) return;
    setSavingGroupId(groupId);
    setErrorMessage(null);
    try {
      await window.desktopApi.deletePersonGroup(groupId);
      setPendingDeleteGroup(null);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setMembersByGroupId((prev) => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete group.");
    } finally {
      setSavingGroupId(null);
    }
  }, [pendingDeleteGroup]);

  return {
    groups,
    membersByGroupId,
    isLoading,
    errorMessage,
    newName,
    setNewName,
    isCreating,
    editingGroupId,
    draftName,
    setDraftName,
    savingGroupId,
    pendingDeleteGroup,
    load,
    handleRemovePersonFromGroup,
    handleCreate,
    startEdit,
    cancelEdit,
    saveEdit,
    requestDelete,
    confirmDelete,
    cancelDelete,
  };
}

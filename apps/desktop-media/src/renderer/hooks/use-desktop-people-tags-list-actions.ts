import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { DesktopPersonTagWithFaceCount } from "../../shared/ipc";
import { createDesktopPeopleActions } from "../actions/people-actions";
import { isValidIsoDateString } from "../lib/birth-date-input";
import { comparePersonTagRows } from "../lib/compare-person-tag-rows";

const peopleActions = createDesktopPeopleActions();

export function useDesktopPeopleTagsListActions(
  setRows: Dispatch<SetStateAction<DesktopPersonTagWithFaceCount[]>>,
  setPinBusyId: Dispatch<SetStateAction<string | null>>,
  setErrorMessage: Dispatch<SetStateAction<string | null>>,
  refreshListAndLiveSimilarCounts: () => Promise<void>,
): {
  birthDateHidden: boolean;
  toggleBirthDateHidden: () => void;
  addOpen: boolean;
  openAddRow: () => void;
  cancelAdd: () => void;
  createPerson: (label: string, birthDate: string | null) => Promise<void>;
  handleSetPinned: (tagId: string, pinned: boolean) => Promise<void>;
  pendingDelete: {
    tagId: string;
    label: string;
    faceCount: number;
    mediaItemCount: number;
  } | null;
  requestDeletePerson: (row: DesktopPersonTagWithFaceCount) => Promise<void>;
  confirmDeletePerson: () => Promise<void>;
  cancelDeletePerson: () => void;
} {
  const [birthDateHidden, setBirthDateHidden] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    tagId: string;
    label: string;
    faceCount: number;
    mediaItemCount: number;
  } | null>(null);

  const handleSetPinned = useCallback(
    async (tagId: string, pinned: boolean) => {
      setPinBusyId(tagId);
      setErrorMessage(null);
      try {
        const updated = await peopleActions.setPersonTagPinned(tagId, pinned);
        setRows((current) =>
          current
            .map((row) =>
              row.id === tagId
                ? { ...row, pinned: updated.pinned, label: updated.label, birthDate: updated.birthDate }
                : row,
            )
            .sort(comparePersonTagRows),
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to update pin.");
      } finally {
        setPinBusyId(null);
      }
    },
    [setRows, setPinBusyId, setErrorMessage],
  );

  const toggleBirthDateHidden = useCallback(() => {
    setBirthDateHidden((current) => !current);
  }, []);

  const openAddRow = useCallback(() => {
    setAddOpen(true);
    setErrorMessage(null);
  }, [setErrorMessage]);

  const cancelAdd = useCallback(() => {
    setAddOpen(false);
  }, []);

  const createPerson = useCallback(
    async (label: string, birthDate: string | null) => {
      const trimmedName = label.trim();
      if (!trimmedName) {
        setErrorMessage("Person name is required.");
        return;
      }
      const bdTrim = birthDate?.trim() ?? "";
      if (bdTrim !== "" && !isValidIsoDateString(bdTrim)) {
        setErrorMessage("Enter a valid birth date (YYYY-MM-DD), or leave empty.");
        return;
      }
      setErrorMessage(null);
      try {
        const bd = bdTrim === "" ? null : bdTrim;
        await peopleActions.createPersonTag(trimmedName, bd);
        setAddOpen(false);
        await refreshListAndLiveSimilarCounts();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to create person.");
      }
    },
    [refreshListAndLiveSimilarCounts, setErrorMessage],
  );

  const deleteAndRefresh = useCallback(
    async (tagId: string) => {
      setErrorMessage(null);
      try {
        await peopleActions.deletePersonTag(tagId);
        setRows((current) => current.filter((row) => row.id !== tagId));
        await refreshListAndLiveSimilarCounts();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to delete person.");
      }
    },
    [refreshListAndLiveSimilarCounts, setErrorMessage, setRows],
  );

  const requestDeletePerson = useCallback(
    async (row: DesktopPersonTagWithFaceCount) => {
      setErrorMessage(null);
      try {
        const usage = await peopleActions.getPersonTagDeleteUsage(row.id);
        if (usage.faceCount > 0 || usage.mediaItemCount > 0) {
          setPendingDelete({ ...usage, label: usage.label || row.label });
          return;
        }
        await deleteAndRefresh(row.id);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to prepare delete.");
      }
    },
    [deleteAndRefresh, setErrorMessage],
  );

  const confirmDeletePerson = useCallback(async () => {
    if (!pendingDelete) return;
    const tagId = pendingDelete.tagId;
    setPendingDelete(null);
    await deleteAndRefresh(tagId);
  }, [deleteAndRefresh, pendingDelete]);

  const cancelDeletePerson = useCallback(() => {
    setPendingDelete(null);
  }, []);

  return {
    birthDateHidden,
    toggleBirthDateHidden,
    addOpen,
    openAddRow,
    cancelAdd,
    createPerson,
    handleSetPinned,
    pendingDelete,
    requestDeletePerson,
    confirmDeletePerson,
    cancelDeletePerson,
  };
}

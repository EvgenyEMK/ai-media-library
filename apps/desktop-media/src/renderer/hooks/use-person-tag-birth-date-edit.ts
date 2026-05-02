import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { DesktopPersonTagWithFaceCount } from "../../shared/ipc";
import { comparePersonTagRows } from "../lib/compare-person-tag-rows";
import { createDesktopPeopleActions } from "../actions/people-actions";

const peopleActions = createDesktopPeopleActions();

export function usePersonTagBirthDateEdit(
  setRows: Dispatch<SetStateAction<DesktopPersonTagWithFaceCount[]>>,
  setErrorMessage: Dispatch<SetStateAction<string | null>>,
): {
  editingBirthTagId: string | null;
  draftBirthDate: string;
  savingBirthTagId: string | null;
  setDraftBirthDate: (value: string) => void;
  startBirthEdit: (row: DesktopPersonTagWithFaceCount) => void;
  cancelBirthEdit: () => void;
  saveBirthEdit: (tagId: string) => Promise<void>;
} {
  const [editingBirthTagId, setEditingBirthTagId] = useState<string | null>(null);
  const [draftBirthDate, setDraftBirthDate] = useState("");
  const [savingBirthTagId, setSavingBirthTagId] = useState<string | null>(null);

  const startBirthEdit = useCallback((row: DesktopPersonTagWithFaceCount) => {
    setEditingBirthTagId(row.id);
    setDraftBirthDate(row.birthDate ?? "");
    setErrorMessage(null);
  }, [setErrorMessage]);

  const cancelBirthEdit = useCallback(() => {
    setEditingBirthTagId(null);
    setDraftBirthDate("");
  }, []);

  const saveBirthEdit = useCallback(
    async (tagId: string) => {
      const trimmed = draftBirthDate.trim();
      const payload = trimmed === "" ? null : trimmed;
      setSavingBirthTagId(tagId);
      setErrorMessage(null);
      try {
        const updated = await peopleActions.updatePersonTagBirthDate(tagId, payload);
        setRows((current) =>
          current
            .map((row) =>
              row.id === tagId
                ? {
                    ...row,
                    birthDate: updated.birthDate,
                    pinned: updated.pinned,
                    label: updated.label,
                  }
                : row,
            )
            .sort(comparePersonTagRows),
        );
        setEditingBirthTagId(null);
        setDraftBirthDate("");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to update birth date.");
      } finally {
        setSavingBirthTagId(null);
      }
    },
    [draftBirthDate, setRows, setErrorMessage],
  );

  return {
    editingBirthTagId,
    draftBirthDate,
    savingBirthTagId,
    setDraftBirthDate,
    startBirthEdit,
    cancelBirthEdit,
    saveBirthEdit,
  };
}

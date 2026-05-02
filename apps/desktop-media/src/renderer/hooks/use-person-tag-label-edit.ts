import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { DesktopPersonTagWithFaceCount } from "../../shared/ipc";
import { createDesktopPeopleActions } from "../actions/people-actions";
import { formatIsoDateInput, isValidIsoDateString } from "../lib/birth-date-input";
import { comparePersonTagRows } from "../lib/compare-person-tag-rows";

const peopleActions = createDesktopPeopleActions();

export function usePersonTagLabelEdit(
  setRows: Dispatch<SetStateAction<DesktopPersonTagWithFaceCount[]>>,
  setErrorMessage: Dispatch<SetStateAction<string | null>>,
): {
  editingId: string | null;
  draftLabel: string;
  draftBirthDate: string;
  savingId: string | null;
  setDraftLabel: (value: string) => void;
  setDraftBirthDate: (value: string) => void;
  startEdit: (row: DesktopPersonTagWithFaceCount) => void;
  cancelEdit: () => void;
  saveEdit: (tagId: string) => Promise<void>;
} {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftBirthDate, setDraftBirthDateState] = useState("");
  const setDraftBirthDate = useCallback((value: string) => {
    setDraftBirthDateState(formatIsoDateInput(value));
  }, []);
  const [savingId, setSavingId] = useState<string | null>(null);

  const startEdit = useCallback((row: DesktopPersonTagWithFaceCount) => {
    setEditingId(row.id);
    setDraftLabel(row.label);
    setDraftBirthDateState(row.birthDate ?? "");
    setErrorMessage(null);
  }, [setErrorMessage]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setDraftLabel("");
    setDraftBirthDateState("");
  }, []);

  const saveEdit = useCallback(
    async (tagId: string) => {
      const trimmed = draftLabel.trim();
      if (!trimmed) return;
      const bdTrim = draftBirthDate.trim();
      if (bdTrim !== "" && !isValidIsoDateString(bdTrim)) {
        setErrorMessage("Enter a valid birth date (YYYY-MM-DD), or leave empty.");
        return;
      }
      setSavingId(tagId);
      setErrorMessage(null);
      try {
        const renamed = await peopleActions.updatePersonTagLabel(tagId, trimmed);
        const updated = await peopleActions.updatePersonTagBirthDate(
          tagId,
          bdTrim === "" ? null : bdTrim,
        );
        setRows((current) =>
          current
            .map((row) =>
              row.id === tagId
                ? {
                    ...row,
                    label: updated.label || renamed.label,
                    pinned: updated.pinned,
                    birthDate: updated.birthDate,
                  }
                : row,
            )
            .sort(comparePersonTagRows),
        );
        setEditingId(null);
        setDraftLabel("");
        setDraftBirthDateState("");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to update person.");
      } finally {
        setSavingId(null);
      }
    },
    [draftBirthDate, draftLabel, setRows, setErrorMessage],
  );

  return {
    editingId,
    draftLabel,
    draftBirthDate,
    savingId,
    setDraftLabel,
    setDraftBirthDate,
    startEdit,
    cancelEdit,
    saveEdit,
  };
}

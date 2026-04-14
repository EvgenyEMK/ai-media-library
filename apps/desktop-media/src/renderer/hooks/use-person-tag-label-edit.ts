import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { DesktopPersonTagWithFaceCount } from "../../shared/ipc";
import { comparePersonTagRows } from "../lib/compare-person-tag-rows";

export function usePersonTagLabelEdit(
  setRows: Dispatch<SetStateAction<DesktopPersonTagWithFaceCount[]>>,
  setErrorMessage: Dispatch<SetStateAction<string | null>>,
): {
  editingId: string | null;
  draftLabel: string;
  savingId: string | null;
  setDraftLabel: (value: string) => void;
  startEdit: (row: DesktopPersonTagWithFaceCount) => void;
  cancelEdit: () => void;
  saveEdit: (tagId: string) => Promise<void>;
} {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const startEdit = useCallback((row: DesktopPersonTagWithFaceCount) => {
    setEditingId(row.id);
    setDraftLabel(row.label);
    setErrorMessage(null);
  }, [setErrorMessage]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setDraftLabel("");
  }, []);

  const saveEdit = useCallback(
    async (tagId: string) => {
      const trimmed = draftLabel.trim();
      if (!trimmed) return;
      setSavingId(tagId);
      setErrorMessage(null);
      try {
        const updated = await window.desktopApi.updatePersonTagLabel(tagId, trimmed);
        setRows((current) =>
          current
            .map((row) =>
              row.id === tagId ? { ...row, label: updated.label, pinned: updated.pinned } : row,
            )
            .sort(comparePersonTagRows),
        );
        setEditingId(null);
        setDraftLabel("");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to update name.");
      } finally {
        setSavingId(null);
      }
    },
    [draftLabel, setRows, setErrorMessage],
  );

  return {
    editingId,
    draftLabel,
    savingId,
    setDraftLabel,
    startEdit,
    cancelEdit,
    saveEdit,
  };
}

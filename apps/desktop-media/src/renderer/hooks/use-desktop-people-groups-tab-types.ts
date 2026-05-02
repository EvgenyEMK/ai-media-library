import type { DesktopPersonGroup, DesktopPersonTag } from "../../shared/ipc";

export interface DesktopPeopleGroupsTabState {
  groups: DesktopPersonGroup[];
  membersByGroupId: Record<string, DesktopPersonTag[]>;
  isLoading: boolean;
  errorMessage: string | null;
  newName: string;
  setNewName: (v: string) => void;
  isCreating: boolean;
  editingGroupId: string | null;
  draftName: string;
  setDraftName: (v: string) => void;
  savingGroupId: string | null;
  pendingDeleteGroup: DesktopPersonGroup | null;
  load: () => Promise<void>;
  handleRemovePersonFromGroup: (groupId: string, person: DesktopPersonTag) => Promise<void>;
  handleCreate: () => Promise<void>;
  startEdit: (g: DesktopPersonGroup) => void;
  cancelEdit: () => void;
  saveEdit: (groupId: string) => Promise<void>;
  requestDelete: (group: DesktopPersonGroup) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
}

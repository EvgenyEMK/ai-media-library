import type { DesktopPersonGroup, DesktopPersonTagWithFaceCount } from "../../shared/ipc";
import type { resolveSimilarUntaggedDisplay } from "../lib/person-similar-untagged-display";

export interface DesktopPeopleTagsListState {
  rows: DesktopPersonTagWithFaceCount[];
  filteredRows: DesktopPersonTagWithFaceCount[];
  visibleRows: DesktopPersonTagWithFaceCount[];
  allGroups: DesktopPersonGroup[];
  groupsByTagId: Record<string, DesktopPersonGroup[]>;
  isLoading: boolean;
  errorMessage: string | null;
  editingId: string | null;
  draftLabel: string;
  draftBirthDate: string;
  savingId: string | null;
  savingGroupTagId: string | null;
  peopleListPage: number;
  setPeopleListPage: (page: number) => void;
  nameFilter: string;
  setNameFilter: (value: string) => void;
  pinBusyId: string | null;
  refreshListAndLiveSimilarCounts: () => Promise<void>;
  setDraftLabel: (value: string) => void;
  setDraftBirthDate: (value: string) => void;
  startEdit: (row: DesktopPersonTagWithFaceCount) => void;
  cancelEdit: () => void;
  saveEdit: (tagId: string) => Promise<void>;
  handleAddGroup: (tagId: string, groupId: string) => Promise<void>;
  handleRemoveGroup: (tagId: string, groupId: string) => Promise<void>;
  handleCreateGroupForTag: (tagId: string, name: string) => Promise<void>;
  handleSetPinned: (tagId: string, pinned: boolean) => Promise<void>;
  resolveSimilarDisplay: (row: DesktopPersonTagWithFaceCount) => ReturnType<
    typeof resolveSimilarUntaggedDisplay
  >;
  showSimilarColumnSpinner: boolean;
  birthDateHidden: boolean;
  toggleBirthDateHidden: () => void;
  addOpen: boolean;
  openAddRow: () => void;
  cancelAdd: () => void;
  createPerson: (label: string, birthDate: string | null) => Promise<void>;
  pendingDelete: {
    tagId: string;
    label: string;
    faceCount: number;
    mediaItemCount: number;
  } | null;
  requestDeletePerson: (row: DesktopPersonTagWithFaceCount) => Promise<void>;
  confirmDeletePerson: () => Promise<void>;
  cancelDeletePerson: () => void;
}

import { useCallback, useEffect, useState } from "react";
import type { DesktopPersonGroup, DesktopPersonTagWithFaceCount } from "../../shared/ipc";
import { comparePersonTagRows } from "../lib/compare-person-tag-rows";
import { loadDesktopPeopleTagsBundle } from "../lib/load-desktop-people-tags-bundle";
import { resolveSimilarUntaggedDisplay } from "../lib/person-similar-untagged-display";
import { useDesktopStore } from "../stores/desktop-store";
import { useDesktopPeopleTagsPagination } from "./use-desktop-people-tags-pagination";
import { usePersonTagGroupActions } from "./use-person-tag-group-actions";
import { usePersonTagLabelEdit } from "./use-person-tag-label-edit";

export const PEOPLE_TAGS_LIST_PAGE_SIZE = 10;

const LOAD_ERROR = "Failed to load people tags.";

export function useDesktopPeopleTagsList(): {
  rows: DesktopPersonTagWithFaceCount[];
  filteredRows: DesktopPersonTagWithFaceCount[];
  visibleRows: DesktopPersonTagWithFaceCount[];
  allGroups: DesktopPersonGroup[];
  groupsByTagId: Record<string, DesktopPersonGroup[]>;
  isLoading: boolean;
  errorMessage: string | null;
  editingId: string | null;
  draftLabel: string;
  savingId: string | null;
  savingGroupTagId: string | null;
  peopleListPage: number;
  setPeopleListPage: (page: number) => void;
  nameFilter: string;
  setNameFilter: (value: string) => void;
  pinBusyId: string | null;
  refreshListAndLiveSimilarCounts: () => Promise<void>;
  setDraftLabel: (value: string) => void;
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
} {
  const [rows, setRows] = useState<DesktopPersonTagWithFaceCount[]>([]);
  const [allGroups, setAllGroups] = useState<DesktopPersonGroup[]>([]);
  const [groupsByTagId, setGroupsByTagId] = useState<Record<string, DesktopPersonGroup[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nameFilter, setNameFilter] = useState("");
  const [pinBusyId, setPinBusyId] = useState<string | null>(null);

  const similarUntaggedCountsByTagId = useDesktopStore((s) => s.similarUntaggedCountsByTagId);
  const similarUntaggedCountsStatus = useDesktopStore((s) => s.similarUntaggedCountsStatus);

  const {
    savingGroupTagId,
    handleAddGroup,
    handleRemoveGroup,
    handleCreateGroupForTag,
  } = usePersonTagGroupActions(groupsByTagId, setGroupsByTagId, setAllGroups, setErrorMessage);

  const {
    editingId,
    draftLabel,
    savingId,
    setDraftLabel,
    startEdit,
    cancelEdit,
    saveEdit,
  } = usePersonTagLabelEdit(setRows, setErrorMessage);

  const { filteredRows, visibleRows, peopleListPage, setPeopleListPage } =
    useDesktopPeopleTagsPagination(rows, nameFilter, PEOPLE_TAGS_LIST_PAGE_SIZE);

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const bundle = await loadDesktopPeopleTagsBundle();
      setRows(bundle.tags);
      setAllGroups(bundle.groups);
      setGroupsByTagId(bundle.groupMap);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : LOAD_ERROR);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshListAndLiveSimilarCounts = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const bundle = await loadDesktopPeopleTagsBundle();
      setRows(bundle.tags);
      setAllGroups(bundle.groups);
      setGroupsByTagId(bundle.groupMap);

      const q = nameFilter.trim().toLowerCase();
      const displayTags = q
        ? bundle.tags.filter((t) => t.label.toLowerCase().includes(q))
        : bundle.tags;
      const start = peopleListPage * PEOPLE_TAGS_LIST_PAGE_SIZE;
      const visibleSlice = displayTags.slice(start, start + PEOPLE_TAGS_LIST_PAGE_SIZE);
      if (visibleSlice.length > 0) {
        const settings = await window.desktopApi.getSettings();
        const threshold = settings.faceDetection.faceRecognitionSimilarityThreshold;
        void window.desktopApi.startSimilarUntaggedFaceCountsJob({
          tagIds: visibleSlice.map((r) => r.id),
          threshold,
        });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : LOAD_ERROR);
    } finally {
      setIsLoading(false);
    }
  }, [peopleListPage, nameFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSetPinned = useCallback(async (tagId: string, pinned: boolean) => {
    setPinBusyId(tagId);
    setErrorMessage(null);
    try {
      const updated = await window.desktopApi.setPersonTagPinned(tagId, pinned);
      setRows((current) =>
        current
          .map((row) => (row.id === tagId ? { ...row, pinned: updated.pinned } : row))
          .sort(comparePersonTagRows),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update pin.");
    } finally {
      setPinBusyId(null);
    }
  }, []);

  const resolveSimilarDisplay = useCallback(
    (row: DesktopPersonTagWithFaceCount) =>
      resolveSimilarUntaggedDisplay(
        row,
        similarUntaggedCountsByTagId,
        similarUntaggedCountsStatus,
      ),
    [similarUntaggedCountsByTagId, similarUntaggedCountsStatus],
  );

  const showSimilarColumnSpinner =
    similarUntaggedCountsStatus === "running" && visibleRows.length > 0;

  return {
    rows,
    filteredRows,
    visibleRows,
    allGroups,
    groupsByTagId,
    isLoading,
    errorMessage,
    editingId,
    draftLabel,
    savingId,
    savingGroupTagId,
    peopleListPage,
    setPeopleListPage,
    nameFilter,
    setNameFilter,
    pinBusyId,
    refreshListAndLiveSimilarCounts,
    setDraftLabel,
    startEdit,
    cancelEdit,
    saveEdit,
    handleAddGroup,
    handleRemoveGroup,
    handleCreateGroupForTag,
    handleSetPinned,
    resolveSimilarDisplay,
    showSimilarColumnSpinner,
  };
}

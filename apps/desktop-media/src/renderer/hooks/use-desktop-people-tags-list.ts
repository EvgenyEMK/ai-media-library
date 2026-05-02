import { useCallback, useEffect, useState } from "react";
import type { DesktopPersonGroup, DesktopPersonTagWithFaceCount } from "../../shared/ipc";
import { loadDesktopPeopleTagsBundle } from "../lib/load-desktop-people-tags-bundle";
import { resolveSimilarUntaggedDisplay } from "../lib/person-similar-untagged-display";
import { useDesktopStore } from "../stores/desktop-store";
import { useDesktopPeopleTagsPagination } from "./use-desktop-people-tags-pagination";
import { useDesktopPeopleTagsListActions } from "./use-desktop-people-tags-list-actions";
import { usePersonTagGroupActions } from "./use-person-tag-group-actions";
import { usePersonTagLabelEdit } from "./use-person-tag-label-edit";
import type { DesktopPeopleTagsListState } from "./use-desktop-people-tags-list-types";

export const PEOPLE_TAGS_LIST_PAGE_SIZE = 10;

const LOAD_ERROR = "Failed to load people tags.";

export function useDesktopPeopleTagsList(): DesktopPeopleTagsListState {
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
    draftBirthDate,
    savingId,
    setDraftLabel,
    setDraftBirthDate,
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

  const {
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
  } = useDesktopPeopleTagsListActions(
    setRows,
    setPinBusyId,
    setErrorMessage,
    refreshListAndLiveSimilarCounts,
  );

  useEffect(() => {
    void load();
  }, [load]);

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
    draftBirthDate,
    savingId,
    savingGroupTagId,
    peopleListPage,
    setPeopleListPage,
    nameFilter,
    setNameFilter,
    pinBusyId,
    refreshListAndLiveSimilarCounts,
    setDraftLabel,
    setDraftBirthDate,
    startEdit,
    cancelEdit,
    saveEdit,
    handleAddGroup,
    handleRemoveGroup,
    handleCreateGroupForTag,
    handleSetPinned,
    resolveSimilarDisplay,
    showSimilarColumnSpinner,
    birthDateHidden,
    toggleBirthDateHidden,
    addOpen,
    openAddRow,
    cancelAdd,
    createPerson,
    pendingDelete,
    requestDeletePerson,
    confirmDeletePerson,
    cancelDeletePerson,
  };
}

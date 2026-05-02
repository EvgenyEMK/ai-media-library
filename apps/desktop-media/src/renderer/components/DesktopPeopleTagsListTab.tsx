import { type ReactElement } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import {
  PEOPLE_TAGS_LIST_PAGE_SIZE,
  useDesktopPeopleTagsList,
} from "../hooks/use-desktop-people-tags-list";
import { PeopleDeleteConfirmDialog } from "./PeopleDeleteConfirmDialog";
import { PeopleDirectoryRow } from "./people-directory-row";
import { PeoplePaginationBar } from "./people-pagination-bar";
import { PeopleTagsListAddRow } from "./PeopleTagsListAddRow";
import { PeopleTagsListHeader } from "./PeopleTagsListHeader";
import { PeopleTagsNameSearchHeader } from "./people-tags-name-search-header";

const UI_TEXT = {
  noFilterMatches: "No people match the filter value",
  description:
    "Manually tagged faces are used to build person's digital profile (centroid) that is used to automatically find other similar faces",
  empty: "No person tags yet. Tag faces in photos or name a cluster in Untagged faces.",
  colName: "Name",
  colBirthDate: "BIRTH DATE",
  colBirthDateHint: "YYYY-MM-DD",
  colTagged: "Tagged faces",
  colSimilar: "Similar faces",
  colGroups: "Groups",
  toggleBirthVisibility: "Show or hide birth dates in the table",
} as const;

export function DesktopPeopleTagsListTab(): ReactElement {
  const {
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
  } = useDesktopPeopleTagsList();

  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8"
      data-testid="people-tags-list-tab"
    >
      <PeopleTagsListHeader
        isLoading={isLoading}
        onRefresh={() => void refreshListAndLiveSimilarCounts()}
        onAddPerson={openAddRow}
      />
      <p className="max-w-3xl text-sm text-muted-foreground md:text-base">{UI_TEXT.description}</p>

      {errorMessage ? (
        <p className="rounded-md border border-destructive/60 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {rows.length === 0 && !isLoading && !addOpen ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
          {UI_TEXT.empty}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[860px] table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[18rem]" />
                <col className="w-[6.5rem]" />
                <col className="w-[7.5rem]" />
                <col />
              </colgroup>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <PeopleTagsNameSearchHeader
                    columnLabel={UI_TEXT.colName}
                    value={nameFilter}
                    onChange={setNameFilter}
                  />
                  <th className="px-3 py-2 align-top">
                    <div className="flex items-start gap-2">
                      <div className="flex min-w-0 flex-col">
                        <span>{UI_TEXT.colBirthDate}</span>
                        <span className="text-[10px] font-normal tracking-normal text-muted-foreground/80">
                          {UI_TEXT.colBirthDateHint}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={toggleBirthDateHidden}
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={UI_TEXT.toggleBirthVisibility}
                        title={UI_TEXT.toggleBirthVisibility}
                      >
                        {birthDateHidden ? (
                          <EyeOff className="size-6" aria-hidden />
                        ) : (
                          <Eye className="size-6" aria-hidden />
                        )}
                      </button>
                    </div>
                  </th>
                  <th className="px-2 py-2 text-right">{UI_TEXT.colTagged}</th>
                  <th className="px-3 py-2 text-right">
                    <span className="inline-flex items-center justify-end gap-2">
                      {showSimilarColumnSpinner ? (
                        <Loader2
                          className="size-3.5 shrink-0 animate-spin text-muted-foreground"
                          aria-hidden
                        />
                      ) : null}
                      {UI_TEXT.colSimilar}
                    </span>
                  </th>
                  <th className="px-3 py-2">{UI_TEXT.colGroups}</th>
                </tr>
              </thead>
              <tbody>
                {addOpen ? (
                  <PeopleTagsListAddRow
                    disabled={isLoading}
                    onSave={(name, birthDate) => createPerson(name, birthDate)}
                    onCancel={cancelAdd}
                  />
                ) : null}
                {!isLoading && filteredRows.length === 0 && rows.length > 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-sm text-muted-foreground"
                    >
                      {UI_TEXT.noFilterMatches}
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row) => (
                    <PeopleDirectoryRow
                      key={row.id}
                      row={row}
                      allGroups={allGroups}
                      assignedGroups={groupsByTagId[row.id] ?? []}
                      isEditing={editingId === row.id}
                      draftLabel={draftLabel}
                      draftBirthDate={draftBirthDate}
                      isSaving={savingId === row.id}
                      isGroupBusy={savingGroupTagId === row.id}
                      similarDisplay={resolveSimilarDisplay(row)}
                      onDraftLabelChange={setDraftLabel}
                      onDraftBirthDateChange={setDraftBirthDate}
                      onStartEdit={() => startEdit(row)}
                      onCancelEdit={cancelEdit}
                      onSaveEdit={() => void saveEdit(row.id)}
                      onDelete={() => void requestDeletePerson(row)}
                      onAddGroup={(groupId) => void handleAddGroup(row.id, groupId)}
                      onRemoveGroup={(groupId) => void handleRemoveGroup(row.id, groupId)}
                      onCreateGroup={(name) => handleCreateGroupForTag(row.id, name)}
                      isPinBusy={pinBusyId === row.id}
                      onPin={() => void handleSetPinned(row.id, true)}
                      onUnpin={() => void handleSetPinned(row.id, false)}
                      birthDateHidden={birthDateHidden}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PeoplePaginationBar
            ariaLabel="People list pagination"
            currentPage={peopleListPage}
            totalItems={filteredRows.length}
            pageSize={PEOPLE_TAGS_LIST_PAGE_SIZE}
            disabled={isLoading}
            onPageChange={setPeopleListPage}
          />
        </div>
      )}
      <PeopleDeleteConfirmDialog
        open={pendingDelete !== null}
        label={pendingDelete?.label ?? ""}
        faceCount={pendingDelete?.faceCount ?? 0}
        mediaItemCount={pendingDelete?.mediaItemCount ?? 0}
        isBusy={false}
        onConfirm={() => void confirmDeletePerson()}
        onCancel={cancelDeletePerson}
      />
    </div>
  );
}

import { type ReactElement } from "react";
import { Loader2 } from "lucide-react";
import {
  PEOPLE_TAGS_LIST_PAGE_SIZE,
  useDesktopPeopleTagsList,
} from "../hooks/use-desktop-people-tags-list";
import { PeopleDirectoryRow } from "./people-directory-row";
import { PeoplePaginationBar } from "./people-pagination-bar";
import { PeopleTagsNameSearchHeader } from "./people-tags-name-search-header";

const UI_TEXT = {
  title: "People",
  noFilterMatches: "No people match the filter value",
  description:
    "Manually tagged faces are used to build person's digital profile (centroid) that is used to automatically find other similar faces",
  refresh: "Refresh",
  refreshAriaLabel:
    "Refresh people list and recompute similar face counts for the current page",
  empty: "No person tags yet. Tag faces in photos or name a cluster in Untagged faces.",
  colName: "Name",
  colTagged: "Tagged faces",
  colSimilar: "Similar faces",
  colGroups: "Groups",
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
  } = useDesktopPeopleTagsList();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold md:text-4xl">{UI_TEXT.title}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
            {UI_TEXT.description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshListAndLiveSimilarCounts()}
          disabled={isLoading}
          title={UI_TEXT.refreshAriaLabel}
          aria-label={UI_TEXT.refreshAriaLabel}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-border px-3 text-sm"
        >
          {isLoading ? "Loading..." : UI_TEXT.refresh}
        </button>
      </header>

      {errorMessage ? (
        <p className="rounded-md border border-destructive/60 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {rows.length === 0 && !isLoading ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
          {UI_TEXT.empty}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <PeopleTagsNameSearchHeader
                    columnLabel={UI_TEXT.colName}
                    value={nameFilter}
                    onChange={setNameFilter}
                  />
                  <th className="px-3 py-2 text-right">{UI_TEXT.colTagged}</th>
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
                {!isLoading && filteredRows.length === 0 && rows.length > 0 ? (
                  <tr>
                    <td
                      colSpan={4}
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
                      isSaving={savingId === row.id}
                      isGroupBusy={savingGroupTagId === row.id}
                      similarDisplay={resolveSimilarDisplay(row)}
                      onDraftLabelChange={setDraftLabel}
                      onStartEdit={() => startEdit(row)}
                      onCancelEdit={cancelEdit}
                      onSaveEdit={() => void saveEdit(row.id)}
                      onAddGroup={(groupId) => void handleAddGroup(row.id, groupId)}
                      onRemoveGroup={(groupId) => void handleRemoveGroup(row.id, groupId)}
                      onCreateGroup={(name) => handleCreateGroupForTag(row.id, name)}
                      isPinBusy={pinBusyId === row.id}
                      onPin={() => void handleSetPinned(row.id, true)}
                      onUnpin={() => void handleSetPinned(row.id, false)}
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
    </div>
  );
}

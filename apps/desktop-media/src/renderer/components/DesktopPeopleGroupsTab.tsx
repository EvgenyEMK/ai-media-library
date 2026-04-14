import { type ReactElement } from "react";
import { Check, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useDesktopPeopleGroupsTab } from "../hooks/use-desktop-people-groups-tab";
import { PeopleMembershipChip } from "./people-membership-chip";
import { Input } from "./ui/input";

const UI_TEXT = {
  title: "People groups",
  description:
    "Organize people into named groups. Deleting a group removes only the grouping, not person tags.",
  refresh: "Refresh",
  empty: "No groups yet. Create one from the People tab or add a group here.",
  noMembers: "No people assigned.",
  namePlaceholder: "Group name",
  create: "Create",
  editName: "Edit name",
  save: "Save",
  cancel: "Cancel",
  delete: "Delete group",
} as const;

const revealOnGroupRowHover =
  "transition-opacity duration-150 max-sm:opacity-100 sm:opacity-0 sm:group-hover/groupRow:opacity-100 sm:group-focus-within/groupRow:opacity-100";

export function DesktopPeopleGroupsTab(): ReactElement {
  const {
    groups,
    membersByGroupId,
    isLoading,
    errorMessage,
    newName,
    setNewName,
    isCreating,
    editingGroupId,
    draftName,
    setDraftName,
    savingGroupId,
    load,
    handleRemovePersonFromGroup,
    handleCreate,
    startEdit,
    cancelEdit,
    saveEdit,
    handleDelete,
  } = useDesktopPeopleGroupsTab();

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
          onClick={() => void load()}
          disabled={isLoading}
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

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-4">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={UI_TEXT.namePlaceholder}
          className="h-9 max-w-xs"
          disabled={isCreating}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleCreate();
          }}
        />
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={isCreating || !newName.trim()}
          className="inline-flex h-9 items-center gap-1 rounded-md border border-primary bg-primary/10 px-3 text-sm text-primary disabled:opacity-50"
        >
          {isCreating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="size-4" aria-hidden />
          )}
          {UI_TEXT.create}
        </button>
      </div>

      {groups.length === 0 && !isLoading ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
          {UI_TEXT.empty}
        </div>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => {
            const members = membersByGroupId[g.id] ?? [];
            const isEditing = editingGroupId === g.id;
            const busy = savingGroupId === g.id;
            return (
              <li
                key={g.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="group/groupRow flex flex-wrap items-center gap-2">
                  {isEditing ? (
                    <>
                      <Input
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        className="h-9 max-w-md flex-1"
                        autoFocus
                        disabled={busy}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveEdit(g.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                      <button
                        type="button"
                        disabled={busy || !draftName.trim()}
                        onClick={() => void saveEdit(g.id)}
                        className="inline-flex size-9 items-center justify-center rounded-md border border-primary bg-primary/10 text-primary disabled:opacity-50"
                        aria-label={UI_TEXT.save}
                        title={UI_TEXT.save}
                      >
                        {busy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Check className="size-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={cancelEdit}
                        className="inline-flex size-9 items-center justify-center rounded-md border border-border hover:bg-muted"
                        aria-label={UI_TEXT.cancel}
                        title={UI_TEXT.cancel}
                      >
                        <X className="size-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <h2 className="min-w-0 flex-1 text-lg font-semibold">{g.name}</h2>
                      <button
                        type="button"
                        onClick={() => startEdit(g)}
                        disabled={busy}
                        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 ${revealOnGroupRowHover}`}
                        aria-label={`${UI_TEXT.editName}: ${g.name}`}
                        title={UI_TEXT.editName}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(g.id)}
                        disabled={busy}
                        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-destructive/50 text-destructive hover:bg-destructive/10 disabled:opacity-50 ${revealOnGroupRowHover}`}
                        aria-label={UI_TEXT.delete}
                        title={UI_TEXT.delete}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{UI_TEXT.noMembers}</p>
                  ) : (
                    members.map((p) => (
                      <PeopleMembershipChip
                        key={p.id}
                        label={p.label}
                        disabled={busy}
                        onRemove={() => void handleRemovePersonFromGroup(g.id, p)}
                        removeAriaLabel={`Remove ${p.label} from this group`}
                        removeTitle="Remove from group"
                      />
                    ))
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

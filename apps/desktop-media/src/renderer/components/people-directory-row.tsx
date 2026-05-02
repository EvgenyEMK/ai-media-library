import { type ReactElement } from "react";
import { Check, Loader2, Pencil, Pin, Trash2, X } from "lucide-react";
import type {
  DesktopPersonGroup,
  DesktopPersonTagWithFaceCount,
} from "../../shared/ipc";
import { formatIsoDateInput } from "../lib/birth-date-input";
import { Input } from "./ui/input";
import { PeopleDirectoryGroupCell } from "./people-directory-group-cell";

const UI_TEXT = {
  save: "Save",
  cancel: "Cancel",
  editName: "Edit name",
  birthDateHiddenLabel: "Birth date hidden",
  birthDateEmpty: "No birth date set",
  /** Single em dash (U+2014) — wider than hyphen for empty date cell */
  birthDateEmptyDash: "\u2014",
  birthDatePlaceholder: "YYYY-MM-DD",
  deletePerson: "Delete person",
  similarCachedHint: "Cached (refresh failed)",
  pinPerson: "Pin person",
  unpinPerson: "Unpin person",
} as const;

export type PeopleSimilarDisplay =
  | { kind: "loading" }
  | { kind: "ready"; value: number }
  | { kind: "fallback"; value: number };

export function PeopleDirectoryRow({
  row,
  allGroups,
  assignedGroups,
  isEditing,
  draftLabel,
  draftBirthDate,
  isSaving,
  isGroupBusy,
  similarDisplay,
  onDraftLabelChange,
  onDraftBirthDateChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onAddGroup,
  onRemoveGroup,
  onCreateGroup,
  onPin,
  onUnpin,
  isPinBusy,
  birthDateHidden,
}: {
  row: DesktopPersonTagWithFaceCount;
  allGroups: DesktopPersonGroup[];
  assignedGroups: DesktopPersonGroup[];
  isEditing: boolean;
  draftLabel: string;
  draftBirthDate: string;
  isSaving: boolean;
  isGroupBusy: boolean;
  isPinBusy: boolean;
  similarDisplay: PeopleSimilarDisplay;
  onDraftLabelChange: (value: string) => void;
  onDraftBirthDateChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onAddGroup: (groupId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onCreateGroup: (name: string) => Promise<void>;
  onPin: () => void;
  onUnpin: () => void;
  birthDateHidden: boolean;
}): ReactElement {
  const revealOnRowHover =
    "transition-opacity duration-150 max-sm:opacity-100 sm:opacity-0 sm:group-hover/peopleRow:opacity-100 sm:group-focus-within/peopleRow:opacity-100";

  return (
    <tr className="group/peopleRow border-b border-border last:border-0">
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap items-center gap-2">
          {isEditing ? (
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Input
                value={draftLabel}
                onChange={(event) => onDraftLabelChange(event.target.value)}
                className="h-9 min-w-[10rem] flex-1"
                autoFocus
                disabled={isSaving}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void onSaveEdit();
                  if (event.key === "Escape") onCancelEdit();
                }}
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void onSaveEdit()}
                    disabled={isSaving || !draftLabel.trim()}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-primary bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
                    aria-label={UI_TEXT.save}
                    title={UI_TEXT.save}
                  >
                    {isSaving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    disabled={isSaving}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border hover:bg-muted disabled:opacity-50"
                    aria-label={UI_TEXT.cancel}
                    title={UI_TEXT.cancel}
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={isSaving}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-destructive/60 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  aria-label={`${UI_TEXT.deletePerson}: ${row.label}`}
                  title={UI_TEXT.deletePerson}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {row.pinned ? (
                <button
                  type="button"
                  onClick={() => void onUnpin()}
                  disabled={isPinBusy}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
                  aria-label={`${UI_TEXT.unpinPerson}: ${row.label}`}
                  title={UI_TEXT.unpinPerson}
                >
                  <Pin className="size-4" fill="currentColor" aria-hidden />
                </button>
              ) : null}
              <span className="min-w-0 flex-1 font-medium">{row.label}</span>
              {!row.pinned ? (
                <button
                  type="button"
                  onClick={() => void onPin()}
                  disabled={isPinBusy}
                  className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 ${revealOnRowHover}`}
                  aria-label={`${UI_TEXT.pinPerson}: ${row.label}`}
                  title={UI_TEXT.pinPerson}
                >
                  <Pin className="size-4" aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                onClick={onStartEdit}
                className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground ${revealOnRowHover}`}
                aria-label={`${UI_TEXT.editName}: ${row.label}`}
                title={UI_TEXT.editName}
              >
                <Pencil className="size-4" />
              </button>
            </>
          )}
        </div>
      </td>
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap items-center gap-2">
          {isEditing ? (
            <>
              <input
                type="text"
                value={draftBirthDate}
                onChange={(event) =>
                  onDraftBirthDateChange(formatIsoDateInput(event.target.value))
                }
                placeholder={UI_TEXT.birthDatePlaceholder}
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                disabled={isSaving}
                className="flex h-9 min-w-[9rem] rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                onKeyDown={(event) => {
                  if (event.key === "Enter") void onSaveEdit();
                  if (event.key === "Escape") onCancelEdit();
                }}
              />
            </>
          ) : (
            <>
              <span
                className="min-w-[7rem] tabular-nums text-muted-foreground"
                title={
                  row.birthDate
                    ? birthDateHidden
                      ? UI_TEXT.birthDateHiddenLabel
                      : undefined
                    : UI_TEXT.birthDateEmpty
                }
                aria-label={!row.birthDate ? UI_TEXT.birthDateEmpty : undefined}
              >
                {row.birthDate && birthDateHidden ? (
                  <span aria-hidden className="tracking-wider">
                    ••••-••-••
                  </span>
                ) : row.birthDate ? (
                  row.birthDate
                ) : (
                  <span
                    className="inline-block min-w-[4.5rem] text-center text-xl font-medium tracking-wide text-muted-foreground"
                    aria-hidden
                  >
                    {UI_TEXT.birthDateEmptyDash}
                  </span>
                )}
              </span>
            </>
          )}
        </div>
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground align-top">
        {row.taggedFaceCount}
      </td>
      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground align-top">
        {similarDisplay.kind === "loading" ? (
          <span className="inline-flex justify-end">
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
            <span className="sr-only">Loading similar face count</span>
          </span>
        ) : (
          <span title={similarDisplay.kind === "fallback" ? UI_TEXT.similarCachedHint : undefined}>
            {similarDisplay.value}
          </span>
        )}
      </td>
      <td className="px-3 py-3 align-top">
        <PeopleDirectoryGroupCell
          assignedGroups={assignedGroups}
          allGroups={allGroups}
          isBusy={isGroupBusy}
          addButtonRevealClassName={revealOnRowHover}
          onRemoveGroup={onRemoveGroup}
          onAddGroup={onAddGroup}
          onCreateGroup={onCreateGroup}
        />
      </td>
    </tr>
  );
}

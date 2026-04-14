import { type ReactElement } from "react";
import { Check, Loader2, Pencil, Pin, X } from "lucide-react";
import type {
  DesktopPersonGroup,
  DesktopPersonTagWithFaceCount,
} from "../../shared/ipc";
import { Input } from "./ui/input";
import { PeopleDirectoryGroupCell } from "./people-directory-group-cell";

const UI_TEXT = {
  save: "Save",
  cancel: "Cancel",
  editName: "Edit name",
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
  isSaving,
  isGroupBusy,
  similarDisplay,
  onDraftLabelChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onAddGroup,
  onRemoveGroup,
  onCreateGroup,
  onPin,
  onUnpin,
  isPinBusy,
}: {
  row: DesktopPersonTagWithFaceCount;
  allGroups: DesktopPersonGroup[];
  assignedGroups: DesktopPersonGroup[];
  isEditing: boolean;
  draftLabel: string;
  isSaving: boolean;
  isGroupBusy: boolean;
  isPinBusy: boolean;
  similarDisplay: PeopleSimilarDisplay;
  onDraftLabelChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onAddGroup: (groupId: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onCreateGroup: (name: string) => Promise<void>;
  onPin: () => void;
  onUnpin: () => void;
}): ReactElement {
  const revealOnRowHover =
    "transition-opacity duration-150 max-sm:opacity-100 sm:opacity-0 sm:group-hover/peopleRow:opacity-100 sm:group-focus-within/peopleRow:opacity-100";

  return (
    <tr className="group/peopleRow border-b border-border last:border-0">
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap items-center gap-2">
          {isEditing ? (
            <>
              {row.pinned ? (
                <button
                  type="button"
                  onClick={() => void onUnpin()}
                  disabled={isSaving || isPinBusy}
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
                  aria-label={`${UI_TEXT.unpinPerson}: ${row.label}`}
                  title={UI_TEXT.unpinPerson}
                >
                  <Pin className="size-4" fill="currentColor" aria-hidden />
                </button>
              ) : null}
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
            </>
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

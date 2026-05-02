import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { Loader2, Plus } from "lucide-react";
import type { DesktopPersonGroup } from "../../shared/ipc";
import { PeopleMembershipChip } from "./people-membership-chip";
import { Input } from "./ui/input";

const UI_TEXT = {
  addGroupAria: "Add group",
  filterPlaceholder: "Search or pick…",
  createNew: "New group…",
  newNamePlaceholder: "New group name",
  confirmNewAria: "Create and assign group",
} as const;

export function PeopleDirectoryGroupCell({
  assignedGroups,
  allGroups,
  isBusy,
  addButtonRevealClassName = "",
  onRemoveGroup,
  onAddGroup,
  onCreateGroup,
}: {
  assignedGroups: DesktopPersonGroup[];
  allGroups: DesktopPersonGroup[];
  isBusy: boolean;
  /** Tailwind classes to reveal the + button on row hover (desktop). */
  addButtonRevealClassName?: string;
  onRemoveGroup: (groupId: string) => void;
  onAddGroup: (groupId: string) => void;
  onCreateGroup: (name: string) => Promise<void>;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [isSavingNew, setIsSavingNew] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupPosition, setPopupPosition] = useState<{ left: number; top: number } | null>(null);

  const assignedIds = useMemo(() => new Set(assignedGroups.map((g) => g.id)), [assignedGroups]);

  const selectable = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return allGroups
      .filter((g) => !assignedIds.has(g.id))
      .filter((g) => (q ? g.name.toLowerCase().includes(q) : true))
      .slice(0, 50);
  }, [allGroups, assignedIds, filter]);

  const updatePopupPosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 256;
    const margin = 8;
    setPopupPosition({
      left: Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin),
      top: rect.bottom + 4,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const el = rootRef.current;
      const popup = popupRef.current;
      const target = event.target as Node;
      if (el && !el.contains(target) && popup && !popup.contains(target)) {
        setOpen(false);
        setCreatingNew(false);
        setFilter("");
        setDraftName("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    updatePopupPosition();
    window.addEventListener("resize", updatePopupPosition);
    window.addEventListener("scroll", updatePopupPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopupPosition);
      window.removeEventListener("scroll", updatePopupPosition, true);
    };
  }, [open, updatePopupPosition]);

  const submitNew = async (): Promise<void> => {
    const trimmed = draftName.trim();
    if (!trimmed || isSavingNew) return;
    setIsSavingNew(true);
    try {
      await onCreateGroup(trimmed);
      setCreatingNew(false);
      setDraftName("");
      setOpen(false);
      setFilter("");
    } finally {
      setIsSavingNew(false);
    }
  };

  return (
    <div ref={rootRef} className="relative flex flex-wrap items-center gap-1.5">
      {assignedGroups.map((g) => (
        <PeopleMembershipChip
          key={g.id}
          label={g.name}
          disabled={isBusy}
          onRemove={() => onRemoveGroup(g.id)}
          removeAriaLabel={`Remove group ${g.name}`}
        />
      ))}

      <div className="relative inline-flex">
        <button
          type="button"
          ref={buttonRef}
          disabled={isBusy}
          onClick={() => {
            setOpen((v) => {
              const next = !v;
              if (next) {
                setFilter("");
                setDraftName("");
                setCreatingNew(allGroups.length === 0);
              } else {
                setCreatingNew(false);
                setFilter("");
                setDraftName("");
              }
              return next;
            });
          }}
          className={`inline-flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 ${addButtonRevealClassName}`}
          aria-label={UI_TEXT.addGroupAria}
          title={UI_TEXT.addGroupAria}
        >
          <Plus className="size-4" aria-hidden />
        </button>

        {open && popupPosition
          ? createPortal(
          <div
            ref={popupRef}
            className="fixed z-50 w-64 rounded-md border border-border bg-popover p-2 shadow-lg"
            style={{ left: popupPosition.left, top: popupPosition.top }}
          >
            {creatingNew ? (
              <div className="flex items-center gap-1">
                <Input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder={UI_TEXT.newNamePlaceholder}
                  className="h-8 flex-1 text-xs"
                  autoFocus
                  disabled={isSavingNew}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitNew();
                    if (e.key === "Escape") {
                      setCreatingNew(false);
                      setDraftName("");
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={isSavingNew || !draftName.trim()}
                  onClick={() => void submitNew()}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-primary bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
                  aria-label={UI_TEXT.confirmNewAria}
                  title={UI_TEXT.confirmNewAria}
                >
                  {isSavingNew ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Plus className="size-4" aria-hidden />
                  )}
                </button>
              </div>
            ) : (
              <>
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={UI_TEXT.filterPlaceholder}
                  className="mb-2 h-8 text-xs"
                  autoFocus
                />
                <ul className="max-h-48 space-y-0.5 overflow-y-auto text-xs">
                  {selectable.map((g) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        className="w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                        onClick={() => {
                          onAddGroup(g.id);
                          setOpen(false);
                          setFilter("");
                        }}
                      >
                        {g.name}
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      className="w-full rounded px-2 py-1.5 text-left font-medium text-primary hover:bg-muted"
                      onClick={() => {
                        setCreatingNew(true);
                        setDraftName(filter.trim());
                        setFilter("");
                      }}
                    >
                      {UI_TEXT.createNew}
                    </button>
                  </li>
                </ul>
              </>
            )}
          </div>,
          document.body,
        )
          : null}
      </div>

    </div>
  );
}

import { type ReactElement, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { formatIsoDateInput, isValidIsoDateString } from "../lib/birth-date-input";
import { Input } from "./ui/input";

const UI_TEXT = {
  namePlaceholder: "Name",
  birthDatePlaceholder: "YYYY-MM-DD",
  save: "Save",
  cancel: "Cancel",
  saving: "Saving…",
} as const;

export function PeopleTagsListAddRow({
  disabled,
  onSave,
  onCancel,
}: {
  disabled: boolean;
  onSave: (name: string, birthDate: string | null) => Promise<void>;
  onCancel: () => void;
}): ReactElement {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [birthDateError, setBirthDateError] = useState<string | null>(null);

  const handleSave = async (): Promise<void> => {
    const bd = birthDate.trim();
    if (bd !== "" && !isValidIsoDateString(bd)) {
      setBirthDateError("Use a valid date (YYYY-MM-DD) or leave empty.");
      return;
    }
    setBirthDateError(null);
    setSaving(true);
    try {
      await onSave(name, bd === "" ? null : bd);
      setName("");
      setBirthDate("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-border bg-muted/20">
      <td className="px-3 py-3 align-top" colSpan={2}>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={UI_TEXT.namePlaceholder}
            className="h-9 min-w-[10rem] flex-1"
            disabled={disabled || saving}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Escape") onCancel();
              if (event.key === "Enter") void handleSave();
            }}
          />
          <input
            type="text"
            value={birthDate}
            onChange={(event) => {
              setBirthDateError(null);
              setBirthDate(formatIsoDateInput(event.target.value));
            }}
            placeholder={UI_TEXT.birthDatePlaceholder}
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            disabled={disabled || saving}
            className="flex h-9 min-w-[9rem] rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={disabled || saving || !name.trim()}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-primary bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
            aria-label={UI_TEXT.save}
            title={UI_TEXT.save}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled || saving}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border hover:bg-muted disabled:opacity-50"
            aria-label={UI_TEXT.cancel}
            title={UI_TEXT.cancel}
          >
            <X className="size-4" />
          </button>
        </div>
        {birthDateError ? (
          <p className="mt-1 text-xs text-destructive">{birthDateError}</p>
        ) : null}
        {saving ? <p className="mt-1 text-xs text-muted-foreground">{UI_TEXT.saving}</p> : null}
      </td>
      <td className="px-3 py-3 align-top" />
      <td className="px-3 py-3 align-top" />
      <td className="px-3 py-3 align-top" />
    </tr>
  );
}

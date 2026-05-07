import { useMemo, useState, type ReactElement } from "react";
import { UserPlus } from "lucide-react";
import type { DesktopPersonTagWithFaceCount } from "../../shared/ipc";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  getAlphabeticalFaceTagOptions,
  getSearchFaceTagOptions,
  getTopFaceTagOptions,
} from "../lib/face-tag-select-options";

export const SELECT_NONE = "__none__";
export const SELECT_CREATE = "__create__";

interface FaceTagSelectProps {
  value: string;
  disabled?: boolean;
  personTags: DesktopPersonTagWithFaceCount[];
  onAssignTag: (tagId: string) => void;
  onCreateTag: () => void;
}

export function FaceTagSelect({
  value,
  disabled,
  personTags,
  onAssignTag,
  onCreateTag,
}: FaceTagSelectProps): ReactElement {
  const [query, setQuery] = useState("");
  const visibleTags = useMemo(
    () => getSearchFaceTagOptions(personTags, query),
    [personTags, query],
  );
  const selectedTagId = value === SELECT_NONE ? null : value;
  const topTags = useMemo(
    () => getTopFaceTagOptions(personTags, selectedTagId),
    [personTags, selectedTagId],
  );
  const topTagIds = useMemo(() => new Set(topTags.map((tag) => tag.id)), [topTags]);
  const alphabeticalTags = useMemo(
    () => getAlphabeticalFaceTagOptions(personTags, topTagIds),
    [personTags, topTagIds],
  );

  const hasSearch = query.trim().length > 0;
  const hasPersonTags = personTags.length > 0;
  return (
    <Select
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue === SELECT_CREATE) {
          onCreateTag();
          return;
        }
        onAssignTag(nextValue);
      }}
      disabled={disabled}
      onOpenChange={(open) => {
        if (!open) {
          setQuery("");
        }
      }}
    >
      <SelectTrigger size="sm" className="min-w-[200px] justify-between">
        <SelectValue placeholder="Assign person" />
      </SelectTrigger>
      <SelectContent
        useNativeScroll
        nativeScrollHeader={
          hasPersonTags ? (
            <div className="px-1 pt-1 pb-1" onPointerDown={(event) => event.stopPropagation()}>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
                placeholder="Quick search person tag..."
                className="h-8"
                aria-label="Quick search person tags"
              />
            </div>
          ) : null
        }
      >
        <SelectItem value={SELECT_CREATE}>
          <div className="flex items-center gap-2">
            <UserPlus className="size-4" />
            Create new person tag...
          </div>
        </SelectItem>
        <SelectSeparator />
        <SelectItem value={SELECT_NONE}>Unassigned</SelectItem>
        <SelectSeparator />
        {hasSearch ? (
          <>
            {visibleTags.map((tag) => (
              <SelectItem key={`search-${tag.id}`} value={tag.id}>
                {tag.label}
              </SelectItem>
            ))}
            {visibleTags.length === 0 ? (
              <div className="px-2 py-1 text-xs text-muted-foreground">No matching person tags.</div>
            ) : null}
          </>
        ) : (
          <>
            {topTags.map((tag) => (
              <SelectItem key={`top-${tag.id}`} value={tag.id}>
                {tag.label}
              </SelectItem>
            ))}
            {topTags.length > 0 ? <SelectSeparator /> : null}
            {alphabeticalTags.map((tag) => (
              <SelectItem key={`all-${tag.id}`} value={tag.id}>
                {tag.label}
              </SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  );
}

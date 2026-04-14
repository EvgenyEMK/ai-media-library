import { useMemo, useState, type ReactElement } from "react";
import { PeopleTagsNameSearchRow } from "./people-tags-name-search-header";
import {
  getSemanticSearchVisiblePersonTagIds,
  semanticSearchPersonTagsShouldOfferShowAll,
  type PersonTagListMeta,
} from "../lib/tagged-faces-tab-visible-tags";

const UI_TEXT = {
  heading: "Person tags",
  nameFilterPlaceholder: "Name",
  showAllPersonTags: "Show all",
  hideAllPersonTags: "Hide all",
  noFilterMatches: "No people match the filter.",
} as const;

export function SemanticSearchPersonTagsBar({
  tagsMeta,
  selectedTagIds,
  onToggleTag,
}: {
  tagsMeta: PersonTagListMeta[];
  selectedTagIds: readonly string[];
  onToggleTag: (tagId: string) => void;
}): ReactElement | null {
  const [nameFilter, setNameFilter] = useState("");
  const [tagsListExpanded, setTagsListExpanded] = useState(false);
  const [lastToggledNonPinnedIds, setLastToggledNonPinnedIds] = useState<string[]>([]);

  const nameFilterTrimmed = nameFilter.trim();

  const visibleTagIds = useMemo(
    () =>
      getSemanticSearchVisiblePersonTagIds({
        allTags: tagsMeta,
        nameFilterTrimmed,
        tagsListExpanded,
        lastToggledNonPinnedIds,
        selectedTagIds,
      }),
    [tagsMeta, nameFilterTrimmed, tagsListExpanded, lastToggledNonPinnedIds, selectedTagIds],
  );

  const visibleTags = useMemo((): PersonTagListMeta[] => {
    const byId = new Map(tagsMeta.map((t) => [t.id, t] as const));
    return visibleTagIds
      .map((id) => byId.get(id))
      .filter((t): t is PersonTagListMeta => Boolean(t));
  }, [visibleTagIds, tagsMeta]);

  const shouldShowShowAll = useMemo(
    () =>
      semanticSearchPersonTagsShouldOfferShowAll({
        allTags: tagsMeta,
        nameFilterTrimmed,
        tagsListExpanded,
        lastToggledNonPinnedIds,
      }),
    [tagsMeta, nameFilterTrimmed, tagsListExpanded, lastToggledNonPinnedIds],
  );

  const handleChipClick = (tagId: string): void => {
    if (nameFilterTrimmed.length > 0) {
      const meta = tagsMeta.find((t) => t.id === tagId);
      setNameFilter("");
      if (meta && !meta.pinned) {
        setLastToggledNonPinnedIds((prev) =>
          [tagId, ...prev.filter((id) => id !== tagId)].slice(0, 3),
        );
      }
    }
    onToggleTag(tagId);
  };

  if (tagsMeta.length === 0) {
    return null;
  }

  const toolbar = (
    <PeopleTagsNameSearchRow
      value={nameFilter}
      onChange={setNameFilter}
      placeholder={UI_TEXT.nameFilterPlaceholder}
      trailingSlot={
        shouldShowShowAll || tagsListExpanded ? (
          <button
            type="button"
            onClick={() => setTagsListExpanded((expanded) => !expanded)}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-border px-3 text-sm hover:bg-muted"
          >
            {tagsListExpanded ? UI_TEXT.hideAllPersonTags : UI_TEXT.showAllPersonTags}
          </button>
        ) : null
      }
    />
  );

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {UI_TEXT.heading}
      </h3>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          {visibleTags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleChipClick(tag.id)}
                className={`inline-flex h-8 shrink-0 items-center rounded-md border px-3 text-sm transition ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
        {visibleTags.length === 0 && nameFilterTrimmed.length > 0 ? (
          <p className="text-sm text-muted-foreground">{UI_TEXT.noFilterMatches}</p>
        ) : null}
      </div>
    </div>
  );
}

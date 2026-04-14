export interface PersonTagListMeta {
  id: string;
  label: string;
  pinned: boolean;
  taggedFaceCount: number;
}

const MAX_RECENT_NON_PINNED = 3;

function collapsedIdsNoFilter(
  allTags: readonly PersonTagListMeta[],
  lastSelectedNonPinnedIds: readonly string[],
): string[] {
  const byId = new Map(allTags.map((t) => [t.id, t] as const));
  const recentValid = lastSelectedNonPinnedIds
    .filter((id) => byId.has(id))
    .slice(0, MAX_RECENT_NON_PINNED);

  const pinned = allTags
    .filter((t) => t.pinned)
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label));
  if (pinned.length > 0) {
    const pinnedIds = pinned.map((t) => t.id);
    const seen = new Set(pinnedIds);
    const tail: string[] = [];
    for (const id of recentValid) {
      if (seen.has(id)) continue;
      seen.add(id);
      tail.push(id);
    }
    return [...pinnedIds, ...tail];
  }

  const byCount = allTags.slice().sort((a, b) => {
    if (b.taggedFaceCount !== a.taggedFaceCount) {
      return b.taggedFaceCount - a.taggedFaceCount;
    }
    return a.label.localeCompare(b.label);
  });
  const top5 = byCount.slice(0, 5).map((t) => t.id);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of recentValid) {
    if (out.length >= 5) break;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of top5) {
    if (out.length >= 5) break;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Which person-tag chips to show on the Tagged faces tab (collapsed vs expanded, name filter).
 */
export function getTaggedFacesTabVisibleTagIds(args: {
  allTags: readonly PersonTagListMeta[];
  nameFilterTrimmed: string;
  tagsListExpanded: boolean;
  lastSelectedNonPinnedIds: readonly string[];
  selectedTagId: string | null;
}): string[] {
  const { allTags, nameFilterTrimmed, tagsListExpanded, lastSelectedNonPinnedIds, selectedTagId } =
    args;
  const q = nameFilterTrimmed.toLowerCase();
  const matchesFilter = (label: string): boolean => !q || label.toLowerCase().includes(q);

  let ids: string[];
  if (tagsListExpanded || q) {
    ids = allTags.filter((t) => matchesFilter(t.label)).map((t) => t.id);
  } else {
    ids = collapsedIdsNoFilter(allTags, lastSelectedNonPinnedIds);
  }

  if (selectedTagId && !ids.includes(selectedTagId) && allTags.some((t) => t.id === selectedTagId)) {
    return [...ids, selectedTagId];
  }
  return ids;
}

export function taggedFacesTabShouldOfferShowAll(args: {
  allTags: readonly PersonTagListMeta[];
  nameFilterTrimmed: string;
  tagsListExpanded: boolean;
  lastSelectedNonPinnedIds: readonly string[];
}): boolean {
  if (args.tagsListExpanded || args.nameFilterTrimmed.trim().length > 0) {
    return false;
  }
  const visible = getTaggedFacesTabVisibleTagIds({
    allTags: args.allTags,
    nameFilterTrimmed: "",
    tagsListExpanded: false,
    lastSelectedNonPinnedIds: args.lastSelectedNonPinnedIds,
    selectedTagId: null,
  });
  return args.allTags.length > visible.length;
}

/**
 * Visible person-tag chips for AI image search (same collapse/filter rules as Tagged faces,
 * but any number of selected tags stay visible when collapsed).
 */
export function getSemanticSearchVisiblePersonTagIds(args: {
  allTags: readonly PersonTagListMeta[];
  nameFilterTrimmed: string;
  tagsListExpanded: boolean;
  lastToggledNonPinnedIds: readonly string[];
  selectedTagIds: readonly string[];
}): string[] {
  const { allTags, nameFilterTrimmed, tagsListExpanded, lastToggledNonPinnedIds, selectedTagIds } =
    args;
  const q = nameFilterTrimmed.toLowerCase();
  const matchesFilter = (label: string): boolean => !q || label.toLowerCase().includes(q);

  let ids: string[];
  if (tagsListExpanded || q) {
    ids = allTags.filter((t) => matchesFilter(t.label)).map((t) => t.id);
  } else {
    ids = collapsedIdsNoFilter(allTags, lastToggledNonPinnedIds);
  }

  const missing = selectedTagIds.filter(
    (id) => !ids.includes(id) && allTags.some((t) => t.id === id),
  );
  if (missing.length > 0) {
    return [...ids, ...missing];
  }
  return ids;
}

export function semanticSearchPersonTagsShouldOfferShowAll(args: {
  allTags: readonly PersonTagListMeta[];
  nameFilterTrimmed: string;
  tagsListExpanded: boolean;
  lastToggledNonPinnedIds: readonly string[];
}): boolean {
  if (args.tagsListExpanded || args.nameFilterTrimmed.trim().length > 0) {
    return false;
  }
  const visible = getSemanticSearchVisiblePersonTagIds({
    allTags: args.allTags,
    nameFilterTrimmed: "",
    tagsListExpanded: false,
    lastToggledNonPinnedIds: args.lastToggledNonPinnedIds,
    selectedTagIds: [],
  });
  return args.allTags.length > visible.length;
}

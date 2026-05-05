import type { DesktopPersonTagWithFaceCount } from "../../shared/ipc";

const TOP_PERSON_TAG_LIMIT = 7;

function compareByUsageThenLabel(
  a: DesktopPersonTagWithFaceCount,
  b: DesktopPersonTagWithFaceCount,
): number {
  if (b.taggedFaceCount !== a.taggedFaceCount) {
    return b.taggedFaceCount - a.taggedFaceCount;
  }
  const byLabel = a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  if (byLabel !== 0) {
    return byLabel;
  }
  return a.id.localeCompare(b.id);
}

function compareByLabelThenUsage(
  a: DesktopPersonTagWithFaceCount,
  b: DesktopPersonTagWithFaceCount,
): number {
  const byLabel = a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  if (byLabel !== 0) {
    return byLabel;
  }
  if (b.taggedFaceCount !== a.taggedFaceCount) {
    return b.taggedFaceCount - a.taggedFaceCount;
  }
  return a.id.localeCompare(b.id);
}

export function getTopFaceTagOptions(
  tags: DesktopPersonTagWithFaceCount[],
  selectedTagId?: string | null,
  limit = TOP_PERSON_TAG_LIMIT,
): DesktopPersonTagWithFaceCount[] {
  const normalizedLimit = Math.max(1, limit);
  const selectedTag = selectedTagId ? tags.find((tag) => tag.id === selectedTagId) : undefined;
  const sorted = [...tags]
    .filter((tag) => tag.id !== selectedTagId)
    .sort(compareByUsageThenLabel);
  return selectedTag
    ? [selectedTag, ...sorted.slice(0, normalizedLimit - 1)]
    : sorted.slice(0, normalizedLimit);
}

export function getAlphabeticalFaceTagOptions(
  tags: DesktopPersonTagWithFaceCount[],
  excludedTagIds: ReadonlySet<string> = new Set(),
): DesktopPersonTagWithFaceCount[] {
  return [...tags].filter((tag) => !excludedTagIds.has(tag.id)).sort(compareByLabelThenUsage);
}

export function getSearchFaceTagOptions(
  tags: DesktopPersonTagWithFaceCount[],
  query: string,
): DesktopPersonTagWithFaceCount[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const sorted = getAlphabeticalFaceTagOptions(tags);
  if (!normalizedQuery) {
    return sorted;
  }

  const startsWith: DesktopPersonTagWithFaceCount[] = [];
  const contains: DesktopPersonTagWithFaceCount[] = [];
  for (const tag of sorted) {
    const normalizedLabel = tag.label.toLocaleLowerCase();
    if (normalizedLabel.startsWith(normalizedQuery)) {
      startsWith.push(tag);
      continue;
    }
    if (normalizedLabel.includes(normalizedQuery)) {
      contains.push(tag);
    }
  }

  return [...startsWith, ...contains].sort(compareByLabelThenUsage);
}

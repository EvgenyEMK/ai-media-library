import type { DesktopPersonGroup, DesktopPersonTagWithFaceCount } from "../../shared/ipc";

export type DesktopPeopleTagsBundle = {
  tags: DesktopPersonTagWithFaceCount[];
  groups: DesktopPersonGroup[];
  groupMap: Record<string, DesktopPersonGroup[]>;
};

export async function loadDesktopPeopleTagsBundle(): Promise<DesktopPeopleTagsBundle> {
  const [tags, groups] = await Promise.all([
    window.desktopApi.listPersonTagsWithFaceCounts(),
    window.desktopApi.listPersonGroups(),
  ]);
  const tagIds = tags.map((t) => t.id);
  const groupMap =
    tagIds.length > 0 ? await window.desktopApi.getPersonTagGroupsForTagIds(tagIds) : {};
  return { tags, groups, groupMap };
}

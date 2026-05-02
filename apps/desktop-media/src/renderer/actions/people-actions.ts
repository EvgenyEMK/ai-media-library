import type { DesktopPersonTag, DesktopPersonTagDeleteUsage } from "../../shared/ipc";

export interface DesktopPeopleActions {
  createPersonTag: (label: string, birthDate?: string | null) => Promise<DesktopPersonTag>;
  updatePersonTagLabel: (tagId: string, label: string) => Promise<DesktopPersonTag>;
  updatePersonTagBirthDate: (tagId: string, birthDate: string | null) => Promise<DesktopPersonTag>;
  getPersonTagDeleteUsage: (tagId: string) => Promise<DesktopPersonTagDeleteUsage>;
  deletePersonTag: (tagId: string) => Promise<boolean>;
  setPersonTagPinned: (tagId: string, pinned: boolean) => Promise<DesktopPersonTag>;
}

export function createDesktopPeopleActions(): DesktopPeopleActions {
  return {
    createPersonTag(label, birthDate) {
      return window.desktopApi.createPersonTag(label, birthDate);
    },
    updatePersonTagLabel(tagId, label) {
      return window.desktopApi.updatePersonTagLabel(tagId, label);
    },
    updatePersonTagBirthDate(tagId, birthDate) {
      return window.desktopApi.updatePersonTagBirthDate(tagId, birthDate);
    },
    async getPersonTagDeleteUsage(tagId) {
      if (typeof window.desktopApi.getPersonTagDeleteUsage === "function") {
        return window.desktopApi.getPersonTagDeleteUsage(tagId);
      }
      const faces = await window.desktopApi.listFacesForPerson(tagId);
      return {
        tagId,
        label: "",
        faceCount: faces.length,
        mediaItemCount: new Set(faces.map((face) => face.mediaItemId)).size,
      };
    },
    deletePersonTag(tagId) {
      if (typeof window.desktopApi.deletePersonTag !== "function") {
        throw new Error("Delete support is loading. Please restart the desktop app and try again.");
      }
      return window.desktopApi.deletePersonTag(tagId);
    },
    setPersonTagPinned(tagId, pinned) {
      return window.desktopApi.setPersonTagPinned(tagId, pinned);
    },
  };
}

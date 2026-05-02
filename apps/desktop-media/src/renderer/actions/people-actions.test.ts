// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDesktopPeopleActions } from "./people-actions";
import type { DesktopPersonTag } from "../../shared/ipc";

function installDesktopApiMock(): Record<string, ReturnType<typeof vi.fn>> {
  const tag: DesktopPersonTag = {
    id: "t1",
    label: "Ada",
    pinned: false,
    birthDate: "1990-01-02",
  };
  const desktopApi = {
    createPersonTag: vi.fn().mockResolvedValue(tag),
    updatePersonTagLabel: vi.fn().mockResolvedValue(tag),
    updatePersonTagBirthDate: vi.fn().mockResolvedValue(tag),
    getPersonTagDeleteUsage: vi.fn().mockResolvedValue({
      tagId: "t1",
      label: "Ada",
      faceCount: 0,
      mediaItemCount: 0,
    }),
    deletePersonTag: vi.fn().mockResolvedValue(true),
    setPersonTagPinned: vi.fn().mockResolvedValue({ ...tag, pinned: true }),
  };
  Object.defineProperty(window, "desktopApi", {
    value: desktopApi,
    configurable: true,
  });
  return desktopApi;
}

describe("createDesktopPeopleActions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("createPersonTag forwards label and birthDate", async () => {
    const api = installDesktopApiMock();
    const actions = createDesktopPeopleActions();
    await actions.createPersonTag("Ada", "1990-01-02");
    expect(api.createPersonTag).toHaveBeenCalledWith("Ada", "1990-01-02");
  });

  it("updatePersonTagLabel forwards args", async () => {
    const api = installDesktopApiMock();
    const actions = createDesktopPeopleActions();
    await actions.updatePersonTagLabel("t1", "Ada L.");
    expect(api.updatePersonTagLabel).toHaveBeenCalledWith("t1", "Ada L.");
  });

  it("updatePersonTagBirthDate forwards args", async () => {
    const api = installDesktopApiMock();
    const actions = createDesktopPeopleActions();
    await actions.updatePersonTagBirthDate("t1", null);
    expect(api.updatePersonTagBirthDate).toHaveBeenCalledWith("t1", null);
  });

  it("setPersonTagPinned forwards args", async () => {
    const api = installDesktopApiMock();
    const actions = createDesktopPeopleActions();
    await actions.setPersonTagPinned("t1", true);
    expect(api.setPersonTagPinned).toHaveBeenCalledWith("t1", true);
  });

  it("getPersonTagDeleteUsage forwards args", async () => {
    const api = installDesktopApiMock();
    const actions = createDesktopPeopleActions();
    await actions.getPersonTagDeleteUsage("t1");
    expect(api.getPersonTagDeleteUsage).toHaveBeenCalledWith("t1");
  });

  it("deletePersonTag forwards args", async () => {
    const api = installDesktopApiMock();
    const actions = createDesktopPeopleActions();
    await actions.deletePersonTag("t1");
    expect(api.deletePersonTag).toHaveBeenCalledWith("t1");
  });
});

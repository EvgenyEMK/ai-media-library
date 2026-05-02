// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../actions/people-actions", () => ({
  createDesktopPeopleActions: () => ({
    setPersonTagPinned: vi.fn().mockResolvedValue({
      id: "t1",
      label: "Ada",
      pinned: true,
      birthDate: null as string | null,
    }),
    createPersonTag: vi.fn().mockResolvedValue({
      id: "t2",
      label: "New",
      pinned: false,
      birthDate: null as string | null,
    }),
  }),
}));

import { useDesktopPeopleTagsListActions } from "./use-desktop-people-tags-list-actions";

describe("useDesktopPeopleTagsListActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults birth dates hidden and toggles visibility", () => {
    const setRows = vi.fn();
    const setPinBusy = vi.fn();
    const setErr = vi.fn();
    const refresh = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useDesktopPeopleTagsListActions(setRows, setPinBusy, setErr, refresh),
    );

    expect(result.current.birthDateHidden).toBe(true);
    act(() => {
      result.current.toggleBirthDateHidden();
    });
    expect(result.current.birthDateHidden).toBe(false);
  });

  it("opens and closes add row", () => {
    const setRows = vi.fn();
    const setPinBusy = vi.fn();
    const setErr = vi.fn();
    const refresh = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useDesktopPeopleTagsListActions(setRows, setPinBusy, setErr, refresh),
    );

    expect(result.current.addOpen).toBe(false);
    act(() => {
      result.current.openAddRow();
    });
    expect(result.current.addOpen).toBe(true);
    act(() => {
      result.current.cancelAdd();
    });
    expect(result.current.addOpen).toBe(false);
  });
});

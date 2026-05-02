// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DesktopPersonTagWithFaceCount } from "../../shared/ipc";

const { mockUpdateBirthDate } = vi.hoisted(() => ({
  mockUpdateBirthDate: vi.fn(),
}));

vi.mock("../actions/people-actions", () => ({
  createDesktopPeopleActions: () => ({
    updatePersonTagBirthDate: mockUpdateBirthDate,
  }),
}));

import { usePersonTagBirthDateEdit } from "./use-person-tag-birth-date-edit";

describe("usePersonTagBirthDateEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateBirthDate.mockResolvedValue({
      id: "t1",
      label: "Ada",
      pinned: false,
      birthDate: "1990-05-01",
    });
  });

  it("starts edit from row birthDate", () => {
    const setRows = vi.fn();
    const setError = vi.fn();
    const row: DesktopPersonTagWithFaceCount = {
      id: "t1",
      label: "Ada",
      pinned: false,
      birthDate: "1990-05-01",
      taggedFaceCount: 1,
      similarFaceCount: 0,
    };

    const { result } = renderHook(() => usePersonTagBirthDateEdit(setRows, setError));

    act(() => {
      result.current.startBirthEdit(row);
    });

    expect(result.current.editingBirthTagId).toBe("t1");
    expect(result.current.draftBirthDate).toBe("1990-05-01");
  });

  it("save clears edit state and updates rows", async () => {
    const setRows = vi.fn();
    const setError = vi.fn();
    const row: DesktopPersonTagWithFaceCount = {
      id: "t1",
      label: "Ada",
      pinned: false,
      birthDate: null,
      taggedFaceCount: 0,
      similarFaceCount: 0,
    };

    const { result } = renderHook(() => usePersonTagBirthDateEdit(setRows, setError));

    act(() => {
      result.current.startBirthEdit(row);
    });

    act(() => {
      result.current.setDraftBirthDate("1992-06-07");
    });

    await act(async () => {
      await result.current.saveBirthEdit("t1");
    });

    expect(mockUpdateBirthDate).toHaveBeenCalledWith("t1", "1992-06-07");
    expect(result.current.editingBirthTagId).toBe(null);
    expect(setRows).toHaveBeenCalled();
  });

  it("cancel clears edit state", () => {
    const setRows = vi.fn();
    const setError = vi.fn();
    const row: DesktopPersonTagWithFaceCount = {
      id: "t1",
      label: "Ada",
      pinned: false,
      birthDate: null,
      taggedFaceCount: 0,
      similarFaceCount: 0,
    };

    const { result } = renderHook(() => usePersonTagBirthDateEdit(setRows, setError));

    act(() => {
      result.current.startBirthEdit(row);
      result.current.setDraftBirthDate("2001-01-01");
      result.current.cancelBirthEdit();
    });

    expect(result.current.editingBirthTagId).toBe(null);
    expect(result.current.draftBirthDate).toBe("");
  });
});

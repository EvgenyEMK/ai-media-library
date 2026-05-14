// @vitest-environment jsdom

import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useShowRunPipelinesTestUi } from "./use-show-run-pipelines-test-ui";

describe("useShowRunPipelinesTestUi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, "desktopApi");
  });

  it("resolves to true when IPC returns showRunPipelinesTestUi", async () => {
    const getDesktopRuntimeFlags = vi.fn().mockResolvedValue({
      showRunPipelinesTestUi: true,
      skipAutoProductIntro: false,
    });
    Object.defineProperty(window, "desktopApi", {
      configurable: true,
      value: { getDesktopRuntimeFlags } as Pick<typeof window.desktopApi, "getDesktopRuntimeFlags">,
    });

    const { result } = renderHook(() => useShowRunPipelinesTestUi());
    expect(result.current).toBe(false);
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
    expect(getDesktopRuntimeFlags).toHaveBeenCalledTimes(1);
  });

  it("resolves to false when IPC returns showRunPipelinesTestUi false", async () => {
    const getDesktopRuntimeFlags = vi.fn().mockResolvedValue({
      showRunPipelinesTestUi: false,
      skipAutoProductIntro: false,
    });
    Object.defineProperty(window, "desktopApi", {
      configurable: true,
      value: { getDesktopRuntimeFlags } as Pick<typeof window.desktopApi, "getDesktopRuntimeFlags">,
    });

    const { result } = renderHook(() => useShowRunPipelinesTestUi());
    await waitFor(() => expect(getDesktopRuntimeFlags).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });
});

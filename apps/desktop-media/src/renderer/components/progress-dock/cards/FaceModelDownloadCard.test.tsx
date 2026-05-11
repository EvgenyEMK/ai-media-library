// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createDesktopStore, type DesktopStoreState } from "../../../stores/desktop-store";
import { FaceModelDownloadCard, formatModelDownloadBytes } from "./FaceModelDownloadCard";

type FaceModelDownloadState = DesktopStoreState["faceModelDownload"];

function downloadState(overrides: Partial<FaceModelDownloadState> = {}): FaceModelDownloadState {
  return {
    visible: true,
    message: "Downloading face detector model (yolov12l-face)...",
    filename: "yolov12l-face.onnx",
    percent: 42,
    downloadedBytes: 42 * 1024 * 1024,
    totalBytes: 100 * 1024 * 1024,
    status: "running",
    error: null,
    durationMs: null,
    ...overrides,
  };
}

describe("FaceModelDownloadCard", () => {
  afterEach(cleanup);

  it("formats byte counts as megabytes", () => {
    expect(formatModelDownloadBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatModelDownloadBytes(null)).toBe("?");
  });

  it("shows running download progress without a cancel or close action", () => {
    const store = createDesktopStore();

    render(<FaceModelDownloadCard store={store} faceModelDownload={downloadState()} />);

    expect(screen.getByRole("heading", { name: /AI model download - Face detection/i })).toBeVisible();
    expect(screen.getByText(/File: yolov12l-face\.onnx/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument();
  });

  it("allows dismissing failed download status", () => {
    const store = createDesktopStore({
      faceModelDownload: downloadState({
        status: "failed",
        error: "network failed",
      }),
    });

    render(
      <FaceModelDownloadCard
        store={store}
        faceModelDownload={store.getState().faceModelDownload}
      />,
    );

    screen.getByRole("button", { name: /close ai model download status/i }).click();

    expect(store.getState().faceModelDownload.visible).toBe(false);
  });
});

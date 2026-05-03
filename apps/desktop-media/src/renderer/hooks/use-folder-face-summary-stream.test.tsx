// @vitest-environment jsdom

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  FolderAiCoverageReport,
  FolderFaceSummary,
  FolderFaceSummaryStreamEvent,
} from "../../shared/ipc";
import { FOLDER_FACE_SUMMARY_STREAM_ROW_IDS } from "../../shared/ipc";
import { useFolderFaceSummaryStream } from "./use-folder-face-summary-stream";

function minimalCoverage(overrides: Partial<FolderAiCoverageReport> = {}): FolderAiCoverageReport {
  const emptyPipeline = { doneCount: 0, failedCount: 0, totalImages: 0, label: "empty" as const };
  return {
    folderPath: "C:\\photos",
    recursive: false,
    totalImages: 5,
    photo: emptyPipeline,
    face: emptyPipeline,
    semantic: emptyPipeline,
    rotation: emptyPipeline,
    geo: {
      images: { total: 0, withGpsCount: 0, withoutGpsCount: 0, locationDetailsDoneCount: 0 },
      videos: { total: 0, withGpsCount: 0, withoutGpsCount: 0, locationDetailsDoneCount: 0 },
      locationDetails: { doneCount: 0, totalWithGps: 0, label: "empty" },
    },
    ...overrides,
  };
}

function minimalSummary(overrides: Partial<FolderFaceSummary> = {}): FolderFaceSummary {
  return {
    folderPath: "C:\\photos",
    recursive: false,
    totalImages: 0,
    faceAnalyzedImages: 0,
    faceFailedImages: 0,
    imagesWithFaces: 0,
    detectedFaces: 3,
    confirmedTaggedFaces: 1,
    suggestedUntaggedFaces: 0,
    taggedFaces: 1,
    untaggedFaces: 2,
    imagesWithDirectPersonTag: 0,
    facesWithAgeGender: 0,
    facesMissingAgeGender: 0,
    childFaces: 0,
    adultFaces: 0,
    oneMainSubjectWithBackgroundFaces: 0,
    faceCountHistogram: {
      oneFace: 0,
      twoFaces: 0,
      threeFaces: 0,
      fourFaces: 0,
      fiveOrMoreFaces: 0,
    },
    mainSubjectHistogram: {
      oneMainSubject: 1,
      twoMainSubjects: 0,
      threeMainSubjects: 0,
      fourMainSubjects: 0,
      fiveOrMoreMainSubjects: 0,
    },
    topPersonTags: [],
    ...overrides,
  };
}

describe("useFolderFaceSummaryStream", () => {
  const progressListeners: Array<(payload: FolderFaceSummaryStreamEvent) => void> = [];

  beforeEach(() => {
    progressListeners.length = 0;
    (
      window as unknown as {
        desktopApi: typeof window.desktopApi;
      }
    ).desktopApi = {
      startFolderFaceSummaryStream: vi.fn(async (_fp: string, jobId: string) => ({
        folderPath: "C:\\photos",
        jobId,
        rows: [
          {
            rowId: FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.singleFolder,
            folderPath: "C:\\photos",
            name: "",
            recursive: false,
          },
        ],
      })),
      cancelFolderFaceSummaryStream: vi.fn(async () => true),
      onFolderFaceSummaryProgress: vi.fn((cb: (payload: FolderFaceSummaryStreamEvent) => void) => {
        progressListeners.push(cb);
        return (): void => {
          const i = progressListeners.indexOf(cb);
          if (i >= 0) progressListeners.splice(i, 1);
        };
      }),
    } as unknown as typeof window.desktopApi;
  });

  it("fills summaries from progress events and completes", async () => {
    const startMock = vi.mocked(
      window.desktopApi as unknown as { startFolderFaceSummaryStream: ReturnType<typeof vi.fn> },
    ).startFolderFaceSummaryStream;

    startMock.mockImplementation(async (_fp: string, jobId: string) => {
      const rows = [
        {
          rowId: FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.singleFolder,
          folderPath: "C:\\photos",
          name: "",
          recursive: false,
        },
      ];
      queueMicrotask(() => {
        const summary = minimalSummary();
        const coverage = minimalCoverage();
        for (const listener of progressListeners) {
          listener({
            kind: "row",
            jobId,
            rowId: FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.singleFolder,
            summary,
            coverage,
          });
        }
        for (const listener of progressListeners) {
          listener({ kind: "done", jobId });
        }
      });
      return { folderPath: "C:\\photos", jobId, rows };
    });

    const { result } = renderHook(() => useFolderFaceSummaryStream("C:\\photos", true));

    await waitFor(() => {
      expect(result.current.allDone).toBe(true);
    });

    expect(
      result.current.summariesByRowId[FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.singleFolder]?.detectedFaces,
    ).toBe(3);
    expect(result.current.coverageByRowId[FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.singleFolder]?.totalImages).toBe(5);
    expect(result.current.streamError).toBeNull();
  });

  it("clears state when disabled", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useFolderFaceSummaryStream("C:\\photos", enabled),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => {
      expect(result.current.rowSpecs.length).toBeGreaterThan(0);
    });

    rerender({ enabled: false });

    await waitFor(() => {
      expect(result.current.rowSpecs).toEqual([]);
    });
  });
});

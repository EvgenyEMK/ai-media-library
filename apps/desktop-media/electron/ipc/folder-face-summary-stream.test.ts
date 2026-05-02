import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FOLDER_FACE_SUMMARY_STREAM_ROW_IDS,
  folderFaceSummarySubfolderRowId,
  IPC_CHANNELS,
} from "../../src/shared/ipc";
import {
  buildFolderFaceSummaryStreamSpecs,
  registerFolderFaceSummaryStreamHandlers,
  streamFaceSummaryProcessingOrder,
} from "./folder-face-summary-stream";

describe("streamFaceSummaryProcessingOrder", () => {
  it("returns specs unchanged for single-folder layout", () => {
    const specs = buildFolderFaceSummaryStreamSpecs("C:\\photos", []);
    expect(streamFaceSummaryProcessingOrder(specs)).toEqual(specs);
  });

  it("runs direct-only row before recursive rollup when tree has subfolders", () => {
    const specs = buildFolderFaceSummaryStreamSpecs("C:\\photos", [
      { path: "C:\\photos\\a", name: "a" },
    ]);
    expect(specs.map((s) => s.rowId)).toEqual([
      FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedRecursive,
      FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedDirect,
      folderFaceSummarySubfolderRowId("C:\\photos\\a"),
    ]);
    const ordered = streamFaceSummaryProcessingOrder(specs);
    expect(ordered.map((s) => s.rowId)).toEqual([
      FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedDirect,
      FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedRecursive,
      folderFaceSummarySubfolderRowId("C:\\photos\\a"),
    ]);
  });
});

describe("buildFolderFaceSummaryStreamSpecs", () => {
  it("uses single-folder row when there are no children", () => {
    expect(buildFolderFaceSummaryStreamSpecs("C:\\photos", [])).toEqual([
      {
        rowId: FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.singleFolder,
        folderPath: "C:\\photos",
        name: "",
        recursive: false,
      },
    ]);
  });

  it("adds recursive, direct, then each subfolder when children exist", () => {
    const rows = buildFolderFaceSummaryStreamSpecs("C:\\photos", [
      { path: "C:\\photos\\vacation", name: "vacation" },
    ]);
    expect(rows).toEqual([
      {
        rowId: FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedRecursive,
        folderPath: "C:\\photos",
        name: "",
        recursive: true,
      },
      {
        rowId: FOLDER_FACE_SUMMARY_STREAM_ROW_IDS.selectedDirect,
        folderPath: "C:\\photos",
        name: "",
        recursive: false,
      },
      {
        rowId: folderFaceSummarySubfolderRowId("C:\\photos\\vacation"),
        folderPath: "C:\\photos\\vacation",
        name: "vacation",
        recursive: true,
      },
    ]);
  });
});

type IpcHandler = (event: { sender: { send: ReturnType<typeof vi.fn> } }, ...args: unknown[]) => unknown;

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, IpcHandler>(),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: IpcHandler) => {
      mocks.handlers.set(channel, handler);
    }),
  },
}));

vi.mock("../fs-media", () => ({
  readFolderChildren: vi.fn(async () => []),
}));

vi.mock("../db/folder-ai-coverage", () => ({
  getFolderAiCoverage: vi.fn(() => ({
    folderPath: "C:\\photos",
    recursive: false,
    totalImages: 12,
    photo: { doneCount: 0, failedCount: 0, totalImages: 0, label: "empty" },
    face: { doneCount: 0, failedCount: 0, totalImages: 0, label: "empty" },
    semantic: { doneCount: 0, failedCount: 0, totalImages: 0, label: "empty" },
    rotation: { doneCount: 0, failedCount: 0, totalImages: 0, label: "empty" },
    geo: {
      images: { total: 0, withGpsCount: 0, withoutGpsCount: 0, locationDetailsDoneCount: 0 },
      videos: { total: 0, withGpsCount: 0, withoutGpsCount: 0, locationDetailsDoneCount: 0 },
      locationDetails: { doneCount: 0, totalWithGps: 0, label: "empty" },
    },
  })),
}));

vi.mock("../db/folder-face-summary", () => ({
  getFolderFaceSummary: vi.fn(() => ({
    folderPath: "C:\\photos",
    recursive: false,
    totalImages: 0,
    faceAnalyzedImages: 0,
    faceFailedImages: 0,
    imagesWithFaces: 0,
    detectedFaces: 0,
    confirmedTaggedFaces: 0,
    suggestedUntaggedFaces: 0,
    taggedFaces: 0,
    untaggedFaces: 0,
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
      oneMainSubject: 0,
      twoMainSubjects: 0,
      threeMainSubjects: 0,
      fourMainSubjects: 0,
      fiveOrMoreMainSubjects: 0,
    },
    topPersonTags: [],
  })),
}));

describe("registerFolderFaceSummaryStreamHandlers", () => {
  beforeEach(() => {
    mocks.handlers.clear();
    registerFolderFaceSummaryStreamHandlers();
  });

  it("invokes start handler and emits row then done on sender", async () => {
    const send = vi.fn();
    const start = mocks.handlers.get(IPC_CHANNELS.startFolderFaceSummaryStream);
    expect(start).toBeDefined();

    const ret = (await start?.({ sender: { send } }, "C:\\photos", "job-a")) as {
      rows: Array<{ rowId: string }>;
      jobId: string;
    };

    expect(ret.jobId).toBe("job-a");
    expect(ret.rows).toHaveLength(1);

    await vi.waitFor(() => {
      expect(send.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    const payloads = send.mock.calls.map((c) => c[1]) as Array<{
      kind: string;
      jobId: string;
      coverage?: { totalImages: number };
    }>;
    const rowPayload = payloads.find((p) => p.kind === "row" && p.jobId === "job-a");
    expect(rowPayload?.coverage?.totalImages).toBe(12);
    expect(payloads.some((p) => p.kind === "done" && p.jobId === "job-a")).toBe(true);
  });

  it("cancel returns false for unknown job id", async () => {
    const cancel = mocks.handlers.get(IPC_CHANNELS.cancelFolderFaceSummaryStream);
    expect(cancel).toBeDefined();
    const ret = await cancel?.({ sender: { send: vi.fn() } }, "unknown-job-id");
    expect(ret).toBe(false);
  });
});

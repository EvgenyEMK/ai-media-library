import { describe, expect, it, vi, beforeEach } from "vitest";

const readFileMock = vi.fn();
const statMock = vi.fn();
vi.mock("node:fs/promises", () => ({
  default: {
    readFile: (...args: unknown[]) => readFileMock(...args) as Promise<Buffer>,
    stat: (...args: unknown[]) => statMock(...args) as Promise<{ mtimeMs: number }>,
  },
}));

const jimpReadMock = vi.fn();
vi.mock("jimp", () => ({
  Jimp: {
    read: (...args: unknown[]) => jimpReadMock(...args),
  },
}));

import {
  embedImageWithDecodeFallback,
  isJpegFilePath,
  normalizeVisionEmbedding,
} from "./nomic-vision-image-decode";

function makeRawImageMock(fromBlob: ReturnType<typeof vi.fn>): new (
  ...args: unknown[]
) => { stage: string } {
  function RawImageMock(
    this: unknown,
    _data: Uint8ClampedArray,
    _width: number,
    _height: number,
    _channels: number,
  ): { stage: string } {
    return { stage: "jimp-pixel" };
  }
  (RawImageMock as unknown as { fromBlob: typeof fromBlob }).fromBlob = fromBlob;
  return RawImageMock as unknown as new (...args: unknown[]) => { stage: string };
}

describe("isJpegFilePath", () => {
  it("matches common JPEG extensions case-insensitively", () => {
    expect(isJpegFilePath("a.jpg")).toBe(true);
    expect(isJpegFilePath("a.JPG")).toBe(true);
    expect(isJpegFilePath("a.jpeg")).toBe(true);
    expect(isJpegFilePath("C:\\x\\y.JPEG")).toBe(true);
    expect(isJpegFilePath("/photos/x.jpeg")).toBe(true);
  });

  it("rejects non-jpeg paths", () => {
    expect(isJpegFilePath("a.png")).toBe(false);
    expect(isJpegFilePath("a.jpx")).toBe(false);
    expect(isJpegFilePath("jpeg")).toBe(false);
  });
});

describe("normalizeVisionEmbedding", () => {
  it("L2-normalizes non-zero vectors", () => {
    const v = normalizeVisionEmbedding([3, 4]);
    expect(v[0]).toBeCloseTo(0.6, 5);
    expect(v[1]).toBeCloseTo(0.8, 5);
  });

  it("returns original when norm is zero", () => {
    expect(normalizeVisionEmbedding([0, 0])).toEqual([0, 0]);
  });
});

describe("embedImageWithDecodeFallback", () => {
  beforeEach(() => {
    readFileMock.mockReset();
    statMock.mockReset();
    statMock.mockResolvedValue({ mtimeMs: 17_000_000_000_000 });
    jimpReadMock.mockReset();
  });

  it("uses Jimp only for each JPEG in a batch (no fromBlob, stable across many files)", async () => {
    readFileMock.mockResolvedValue(Buffer.from("unused-for-jpeg"));
    jimpReadMock.mockResolvedValue({
      width: 2,
      height: 2,
      bitmap: { data: new Uint8Array(2 * 2 * 4).fill(90) },
    });

    const fromBlob = vi.fn();
    const RawImageCls = makeRawImageMock(fromBlob);

    const pipe = vi.fn().mockImplementation(() =>
      Promise.resolve({
        data: new Float32Array(768).fill(0.15),
        dims: [1, 197, 768] as number[],
      }),
    );

    const paths = [
      "C:\\photos\\20200413_145525.jpg",
      "C:\\photos\\20200413_145701.jpg",
      "D:\\a\\x.JPEG",
      "/mnt/media/y.jpeg",
      "E:\\last.Jpg",
    ];

    for (const p of paths) {
      const vec = await embedImageWithDecodeFallback(
        pipe as Parameters<typeof embedImageWithDecodeFallback>[0],
        RawImageCls as unknown as Parameters<typeof embedImageWithDecodeFallback>[1],
        p,
      );
      expect(vec).toHaveLength(768);
    }

    expect(fromBlob).not.toHaveBeenCalled();
    expect(jimpReadMock).toHaveBeenCalledTimes(5);
    expect(jimpReadMock.mock.calls.map((c) => c[0])).toEqual(paths);
    expect(pipe).toHaveBeenCalledTimes(5);
  });

  it("retries with Jimp when non-JPEG blob decode succeeds but inference fails (marker error)", async () => {
    readFileMock.mockResolvedValue(Buffer.from("fake-bytes"));
    jimpReadMock.mockResolvedValue({
      width: 2,
      height: 2,
      bitmap: { data: new Uint8Array(2 * 2 * 4).fill(128) },
    });

    const fromBlob = vi.fn().mockResolvedValue({ stage: "blob" });
    const RawImageCls = makeRawImageMock(fromBlob);

    const pipe = vi
      .fn()
      .mockRejectedValueOnce(new Error("marker was not found"))
      .mockResolvedValueOnce({
        data: new Float32Array(768).fill(0.25),
        dims: [1, 197, 768],
      });

    const vec = await embedImageWithDecodeFallback(
      pipe as Parameters<typeof embedImageWithDecodeFallback>[0],
      RawImageCls as unknown as Parameters<typeof embedImageWithDecodeFallback>[1],
      "C:\\photos\\screenshot.png",
    );

    expect(pipe).toHaveBeenCalledTimes(2);
    expect(fromBlob).toHaveBeenCalledTimes(1);
    expect(jimpReadMock).toHaveBeenCalledWith("C:\\photos\\screenshot.png");
    expect(vec).toHaveLength(768);
  });

  it("does not retry inference when Jimp was already used for decode (non-JPEG)", async () => {
    readFileMock.mockResolvedValue(Buffer.from("x"));
    jimpReadMock.mockResolvedValue({
      width: 1,
      height: 1,
      bitmap: { data: new Uint8Array(4).fill(1) },
    });

    const fromBlob = vi.fn().mockRejectedValue(new Error("fromBlob failed"));
    const RawImageCls = makeRawImageMock(fromBlob);

    const pipe = vi.fn().mockRejectedValue(new Error("onnx boom"));

    await expect(
      embedImageWithDecodeFallback(
        pipe as Parameters<typeof embedImageWithDecodeFallback>[0],
        RawImageCls as unknown as Parameters<typeof embedImageWithDecodeFallback>[1],
        "/y.webp",
      ),
    ).rejects.toThrow("onnx boom");

    expect(pipe).toHaveBeenCalledTimes(1);
  });
});

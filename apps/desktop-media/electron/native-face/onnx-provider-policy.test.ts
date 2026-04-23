import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock("onnxruntime-node", () => ({
  InferenceSession: {
    create: mockCreate,
  },
}));

const ORIGINAL_ENV = { ...process.env };

describe("onnx-provider-policy", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.EMK_ONNX_DML_DEVICE_ID;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.EMK_ONNX_DML_DEVICE_ID;
    vi.restoreAllMocks();
  });

  it("returns win32 auto provider order with CPU fallback", async () => {
    const mod = await import("./onnx-provider-policy");
    expect(mod.resolveOnnxProviderCandidates("win32")).toEqual(["cuda", "dml", "cpu"]);
  });

  it("returns linux and darwin defaults", async () => {
    const mod = await import("./onnx-provider-policy");
    expect(mod.resolveOnnxProviderCandidates("linux")).toEqual(["cuda", "cpu"]);
    expect(mod.resolveOnnxProviderCandidates("darwin")).toEqual(["coreml", "cpu"]);
  });

  it("forces CPU mode when env requests it", async () => {
    process.env.EMK_ONNX_PROVIDER_MODE = "cpu";
    const mod = await import("./onnx-provider-policy");
    expect(mod.resolveOnnxProviderCandidates("win32")).toEqual(["cpu"]);
  });

  it("honors explicit provider order and appends CPU in auto mode", async () => {
    process.env.EMK_ONNX_PROVIDER_ORDER = "dml,cuda";
    const mod = await import("./onnx-provider-policy");
    expect(mod.resolveOnnxProviderCandidates("win32")).toEqual(["dml", "cuda", "cpu"]);
  });

  it("falls back from first provider to next provider", async () => {
    process.env.EMK_ONNX_PROVIDER_ORDER = "cuda,dml";
    mockCreate
      .mockRejectedValueOnce(new Error("CUDA unavailable"))
      .mockResolvedValueOnce({ inputNames: [], outputNames: [] });
    const mod = await import("./onnx-provider-policy");

    const session = await mod.createOrtSessionWithFallback({
      modelPath: "c:/models/model.onnx",
      sessionName: "test-session",
    });

    expect(session.provider).toBe("dml");
    expect(mockCreate).toHaveBeenNthCalledWith(
      1,
      "c:/models/model.onnx",
      { executionProviders: ["cuda"] },
    );
    expect(mockCreate).toHaveBeenNthCalledWith(
      2,
      "c:/models/model.onnx",
      { executionProviders: ["dml"] },
    );
  });

  it("throws when all providers fail", async () => {
    process.env.EMK_ONNX_PROVIDER_ORDER = "cuda";
    mockCreate
      .mockRejectedValueOnce(new Error("CUDA unavailable"))
      .mockRejectedValueOnce(new Error("CPU unavailable"));
    const mod = await import("./onnx-provider-policy");

    await expect(
      mod.createOrtSessionWithFallback({
        modelPath: "c:/models/model.onnx",
        sessionName: "test-session",
      }),
    ).rejects.toThrow(/Tried providers: cuda, cpu/);
  });

  it("uses preferred providers when passed explicitly", async () => {
    mockCreate.mockResolvedValueOnce({ inputNames: [], outputNames: [] });
    const mod = await import("./onnx-provider-policy");

    const session = await mod.createOrtSessionWithFallback({
      modelPath: "c:/models/model.onnx",
      sessionName: "test-session",
      preferredProviders: ["cpu", "dml"],
    });

    expect(session.provider).toBe("cpu");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      "c:/models/model.onnx",
      { executionProviders: ["cpu"] },
    );
  });

  it("passes DML device id when configured", async () => {
    process.env.EMK_ONNX_PROVIDER_ORDER = "dml";
    process.env.EMK_ONNX_DML_DEVICE_ID = "0";
    mockCreate.mockResolvedValueOnce({ inputNames: [], outputNames: [] });
    const mod = await import("./onnx-provider-policy");

    await mod.createOrtSessionWithFallback({
      modelPath: "c:/models/model.onnx",
      sessionName: "dml-session",
    });

    expect(mockCreate).toHaveBeenCalledWith(
      "c:/models/model.onnx",
      {
        executionProviders: [
          {
            name: "dml",
            deviceId: 0,
            device_id: 0,
          },
        ],
      },
    );
  });
});

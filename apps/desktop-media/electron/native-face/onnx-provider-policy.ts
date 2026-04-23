import path from "node:path";
import * as ort from "onnxruntime-node";

export type OnnxProvider = "cpu" | "cuda" | "dml" | "coreml";
type ProviderMode = "auto" | "cpu" | "gpu";

const VALID_PROVIDERS: OnnxProvider[] = ["cpu", "cuda", "dml", "coreml"];

function parseProviderMode(raw: string | undefined): ProviderMode {
  if (!raw) return "auto";
  const normalized = raw.trim().toLowerCase();
  if (normalized === "cpu") return "cpu";
  if (normalized === "gpu") return "gpu";
  return "auto";
}

function parseProviderList(raw: string | undefined): OnnxProvider[] {
  if (!raw) return [];
  const deduped = new Set<OnnxProvider>();
  const values = raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is OnnxProvider => VALID_PROVIDERS.includes(p as OnnxProvider));
  for (const provider of values) {
    deduped.add(provider);
  }
  return Array.from(deduped);
}

function defaultProvidersForPlatform(platform: NodeJS.Platform): OnnxProvider[] {
  switch (platform) {
    case "win32":
      // Prefer CUDA for NVIDIA when available; fall back to DirectML.
      return ["cuda", "dml", "cpu"];
    case "linux":
      return ["cuda", "cpu"];
    case "darwin":
      return ["coreml", "cpu"];
    default:
      return ["cpu"];
  }
}

function dedupeProviders(list: OnnxProvider[]): OnnxProvider[] {
  const output: OnnxProvider[] = [];
  const seen = new Set<OnnxProvider>();
  for (const provider of list) {
    if (!seen.has(provider)) {
      output.push(provider);
      seen.add(provider);
    }
  }
  return output;
}

export function resolveOnnxProviderCandidates(
  platform: NodeJS.Platform = process.platform,
): OnnxProvider[] {
  if (process.env.EMK_ONNX_FORCE_CPU === "1") {
    return ["cpu"];
  }

  const mode = parseProviderMode(process.env.EMK_ONNX_PROVIDER_MODE);
  const fromEnv = parseProviderList(process.env.EMK_ONNX_PROVIDER_ORDER);
  const base = fromEnv.length > 0 ? fromEnv : defaultProvidersForPlatform(platform);

  if (mode === "cpu") {
    return ["cpu"];
  }

  if (mode === "gpu") {
    const gpuOnly = base.filter((p) => p !== "cpu");
    if (gpuOnly.length === 0) {
      return ["cpu"];
    }
    return dedupeProviders([...gpuOnly, "cpu"]);
  }

  // auto
  return dedupeProviders(base.includes("cpu") ? base : [...base, "cpu"]);
}

export interface CreateOrtSessionParams {
  modelPath: string;
  sessionName: string;
  preferredProviders?: OnnxProvider[];
}

export interface CreatedOrtSession {
  session: ort.InferenceSession;
  provider: OnnxProvider;
}

function parseDmlDeviceId(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function buildSessionOptionsForProvider(
  provider: OnnxProvider,
): ort.InferenceSession.SessionOptions {
  const dmlDeviceId = parseDmlDeviceId(process.env.EMK_ONNX_DML_DEVICE_ID);
  if (provider === "dml" && dmlDeviceId !== null) {
    // Use both canonical fields for compatibility across ORT JS bindings.
    const executionProviders = [
      {
        name: "dml",
        deviceId: dmlDeviceId,
        device_id: dmlDeviceId,
      },
    ];
    return {
      executionProviders: executionProviders as unknown as ort.InferenceSession.SessionOptions["executionProviders"],
    };
  }
  return { executionProviders: [provider] };
}

export async function createOrtSessionWithFallback(
  params: CreateOrtSessionParams,
): Promise<CreatedOrtSession> {
  const providers = params.preferredProviders?.length
    ? dedupeProviders(params.preferredProviders)
    : resolveOnnxProviderCandidates();
  const modelName = path.basename(params.modelPath);
  let lastError: unknown = null;

  for (const provider of providers) {
    try {
      const session = await ort.InferenceSession.create(
        params.modelPath,
        buildSessionOptionsForProvider(provider),
      );
      const dmlDeviceId = parseDmlDeviceId(process.env.EMK_ONNX_DML_DEVICE_ID);
      const dmlAdapterLabel = process.env.EMK_ONNX_DML_ADAPTER_LABEL?.trim() || null;
      const dmlSuffix =
        provider === "dml" && dmlDeviceId !== null
          ? ` dmlDeviceId=${dmlDeviceId}${dmlAdapterLabel ? ` dmlAdapter="${dmlAdapterLabel}"` : ""}`
          : "";
      console.log(
        `[emk-face][onnx] session-ready name=${params.sessionName} model=${modelName} provider=${provider}${dmlSuffix}`,
      );
      return { session, provider };
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(
        `[emk-face][onnx] provider-failed name=${params.sessionName} model=${modelName} provider=${provider} error=${msg}`,
      );
    }
  }

  const detail =
    lastError instanceof Error ? `${lastError.name}: ${lastError.message}` : String(lastError);
  throw new Error(
    `Failed to initialize ONNX session for ${params.sessionName} (${modelName}). Tried providers: ${providers.join(", ")}. Last error: ${detail}`,
  );
}

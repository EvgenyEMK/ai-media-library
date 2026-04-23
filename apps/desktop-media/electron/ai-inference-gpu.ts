import { execFile } from "node:child_process";

export interface AiInferenceGpuOption {
  id: string;
  label: string;
  dmlDeviceId: number | null;
  source: "auto" | "detected";
}

function execFileText(
  file: string,
  args: string[],
  timeoutMs: number = 5000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: timeoutMs, windowsHide: true }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

async function detectWindowsGpuNames(): Promise<string[]> {
  // CSV parsing is stable enough for this one-column output.
  const script =
    "Get-CimInstance Win32_VideoController | Select-Object -Property Name | ConvertTo-Csv -NoTypeInformation";
  const stdout = await execFileText("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    script,
  ]);
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  // First line is header: "Name"
  return lines
    .slice(1)
    .map((line) => line.replace(/^"|"$/g, "").replace(/""/g, "\""))
    .filter((name) => name.length > 0);
}

export async function detectAiInferenceGpuOptions(): Promise<AiInferenceGpuOption[]> {
  const options: AiInferenceGpuOption[] = [
    {
      id: "auto",
      label: "Automatic (runtime default)",
      dmlDeviceId: null,
      source: "auto",
    },
  ];

  if (process.platform === "win32") {
    try {
      const names = await detectWindowsGpuNames();
      names.forEach((name, idx) => {
        options.push({
          id: `dml:${idx}`,
          label: `DirectML adapter ${idx}: ${name}`,
          dmlDeviceId: idx,
          source: "detected",
        });
      });
    } catch {
      // Keep "auto" only when detection fails.
    }
  }
  return options;
}

export function applyAiInferenceGpuPreference(
  preferredGpuId: string | null | undefined,
  options?: AiInferenceGpuOption[],
): void {
  if (!preferredGpuId || preferredGpuId === "auto") {
    delete process.env.EMK_ONNX_DML_DEVICE_ID;
    delete process.env.EMK_ONNX_DML_ADAPTER_LABEL;
    return;
  }
  if (preferredGpuId.startsWith("dml:")) {
    const idx = Number.parseInt(preferredGpuId.slice(4), 10);
    if (Number.isFinite(idx) && idx >= 0) {
      process.env.EMK_ONNX_DML_DEVICE_ID = String(idx);
      const label = options?.find((opt) => opt.id === preferredGpuId)?.label;
      process.env.EMK_ONNX_DML_ADAPTER_LABEL = label ?? `DirectML adapter ${idx}`;
      return;
    }
  }
  delete process.env.EMK_ONNX_DML_DEVICE_ID;
  delete process.env.EMK_ONNX_DML_ADAPTER_LABEL;
}
